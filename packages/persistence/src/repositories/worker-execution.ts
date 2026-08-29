import type {
  WorkerExecutionRepository,
  WorkerFailure,
} from "@procurement/application/ports";
import { workerCompletions, workerFailures } from "@procurement/db/schema";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

export class DrizzleWorkerExecutionRepository
  implements WorkerExecutionRepository
{
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async claim(
    transaction: Parameters<WorkerExecutionRepository["claim"]>[0],
    idempotencyKey: string,
  ): Promise<boolean> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .insert(workerCompletions)
      .values({ idempotencyKey })
      .onConflictDoNothing({ target: workerCompletions.idempotencyKey })
      .returning({ id: workerCompletions.id });

    return rows.length === 1;
  }

  async recordFailure(
    transaction: Parameters<WorkerExecutionRepository["recordFailure"]>[0],
    failure: WorkerFailure,
  ): Promise<void> {
    await this.unitOfWork
      .databaseFor(transaction)
      .insert(workerFailures)
      .values({
        jobId: failure.jobId,
        queue: failure.queue,
        correlationId: failure.correlationId,
        code: failure.code,
        message: failure.message,
      });
  }
}
