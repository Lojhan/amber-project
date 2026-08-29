import type { UnitOfWork } from "../core/unit-of-work.js";
import type {
  WorkerExecutionRepository,
  WorkerFailure,
} from "../ports/upload.js";

export type WorkerEnvelope<T extends object> = Readonly<{
  id: string;
  queue: string;
  data: T;
}>;

export type WorkerResult = Readonly<{ replayed: boolean }>;

/** The durable claim and all nested command writes share one transaction. */
export class IdempotentWorkerExecutionService {
  constructor(
    private readonly executions: WorkerExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(
    idempotencyKey: string,
    work: () => Promise<void>,
  ): Promise<WorkerResult> {
    return this.unitOfWork.run(async (transaction) => {
      if (!(await this.executions.claim(transaction, idempotencyKey)))
        return { replayed: true };

      await work();

      return { replayed: false };
    });
  }
}

export class RecordWorkerFailureCommandHandler {
  constructor(
    private readonly executions: WorkerExecutionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: WorkerFailure): Promise<void> {
    await this.unitOfWork.run((transaction) =>
      this.executions.recordFailure(transaction, command),
    );
  }
}
