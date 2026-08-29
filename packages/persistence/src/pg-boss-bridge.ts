import type {
  JobScheduler,
  ScheduledJob,
} from "@procurement/application/ports";
import type { DatabaseQueryResult } from "@procurement/db";
import { type Job, PgBoss } from "pg-boss";
import type { DrizzleUnitOfWork } from "./drizzle-unit-of-work.js";
import { transactionConnection } from "./pg-boss-transaction-access.js";

export type QueueEnvelope<Name extends string, Payload> = Readonly<{
  id: string;
  name: Name;
  data: Payload;
}>;

export type QueueDecoder<PayloadMap> = (
  name: Extract<keyof PayloadMap, string>,
  data: unknown,
) => PayloadMap[Extract<keyof PayloadMap, string>];

/** Owns pg-boss lifecycle and translates persisted jobs into application payloads. */
export class PgBossQueue<PayloadMap extends Record<string, unknown>> {
  private readonly boss: PgBoss;

  constructor(
    connectionString: string,
    private readonly decode: QueueDecoder<PayloadMap>,
    boss = new PgBoss({ connectionString }),
  ) {
    this.boss = boss;
  }

  async start(): Promise<void> {
    await this.boss.start();
  }

  create(
    name: string,
    options: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    return this.boss.createQueue(name, options);
  }

  async work<K extends Extract<keyof PayloadMap, string>>(
    name: K,
    handler: (job: QueueEnvelope<K, PayloadMap[K]>) => Promise<unknown>,
  ): Promise<void> {
    await this.boss.work<object, object, { batchSize: 1; perJobResults: true }>(
      name,
      { batchSize: 1, perJobResults: true },
      async (jobs: Job<object>[]) =>
        Promise.all(
          jobs.map(async (job) => {
            const data = this.decode(name, job.data) as PayloadMap[K];
            const output = await handler({ id: job.id, name, data });
            return {
              id: job.id,
              status: "completed",
              output: { result: output },
            };
          }),
        ),
    );
  }

  stop(): Promise<void> {
    return this.boss.stop({ graceful: true, timeout: 30_000 });
  }

  scheduler(unitOfWork: DrizzleUnitOfWork): PgBossJobScheduler {
    return new PgBossJobScheduler(this.boss, unitOfWork);
  }
}

/** The sole bridge from an opaque application transaction to pg-boss SQL. */
export class PgBossJobScheduler implements JobScheduler {
  constructor(
    private readonly boss: Pick<PgBoss, "send">,
    private readonly unitOfWork: DrizzleUnitOfWork,
  ) {}

  async enqueue(
    transaction: Parameters<JobScheduler["enqueue"]>[0],
    input: ScheduledJob,
  ): Promise<string> {
    const connection = this.unitOfWork[transactionConnection](transaction);
    const id = await this.boss.send(
      input.name,
      { payload: input.payload, correlationId: input.correlationId },
      {
        singletonKey: input.idempotencyKey,
        db: {
          executeSql: async (text: string, values: unknown[] = []) =>
            (await connection.query(text, values)) as DatabaseQueryResult,
        },
      },
    );
    if (!id) throw new Error(`pg-boss rejected job ${input.name}`);
    return id;
  }
}
