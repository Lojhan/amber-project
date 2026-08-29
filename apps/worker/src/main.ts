import {
  createProductionWorkerRuntime,
  loadProductionWorkerConfig,
  type ProductionWorkerRuntime,
  toBrandScopedWorkerCommand,
  type WorkerQueueJob,
} from "@procurement/bootstrap/worker";
import { parsePersistedJob } from "./job-schemas.js";

type CorrelatedCommand = Readonly<{ correlationId: string }>;

const failureCode = (error: unknown): string =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : "worker-command-failed";

const execute = async <Command extends CorrelatedCommand>(
  runtime: ProductionWorkerRuntime,
  job: WorkerQueueJob,
  command: Command,
  handler: (command: Command) => Promise<void>,
): Promise<void> => {
  try {
    await runtime.composition.executions.execute(job.id, () =>
      handler(command),
    );
  } catch (error) {
    await runtime.composition.recordFailure.execute({
      jobId: job.id,
      queue: job.name,
      correlationId: command.correlationId,
      code: failureCode(error),
      message: error instanceof Error ? error.message : "Unknown worker error",
    });
    throw error;
  }
};

export const registerConsumers = async (
  runtime: ProductionWorkerRuntime,
): Promise<void> => {
  const { composition, queue } = runtime;

  await queue.work("preflight-quotation", (job) => {
    const command = toBrandScopedWorkerCommand(
      parsePersistedJob("preflight-quotation", job.data),
    );
    return execute(runtime, job, command, (input) =>
      composition.completeQuotationPreflight.execute(input),
    );
  });
  await queue.work("parse-quotation", (job) => {
    const command = toBrandScopedWorkerCommand(
      parsePersistedJob("parse-quotation", job.data),
    );
    return execute(runtime, job, command, (input) =>
      composition.parseQuotation.execute(input),
    );
  });
  await queue.work("match-candidates", (job) => {
    const command = toBrandScopedWorkerCommand(
      parsePersistedJob("match-candidates", job.data),
    );
    return execute(runtime, job, command, (input) =>
      composition.generateMatchCandidates.execute(input),
    );
  });
  await queue.work("negotiation-turn", (job) => {
    const command = toBrandScopedWorkerCommand(
      parsePersistedJob("negotiation-turn", job.data),
    );
    return execute(runtime, job, command, (input) =>
      composition.executeNegotiationTurn.execute(input),
    );
  });
  await queue.work("decision-continuation", (job) => {
    const command = toBrandScopedWorkerCommand(
      parsePersistedJob("decision-continuation", job.data),
    );
    return execute(runtime, job, command, (input) =>
      composition.continueDecision.execute(input),
    );
  });
};

export async function startWorkerProcess(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ close(): Promise<void> }> {
  const runtime = createProductionWorkerRuntime(
    loadProductionWorkerConfig(environment),
  );

  try {
    await runtime.queue.start();
    await runtime.health();
    await registerConsumers(runtime);
    console.info("worker listening");

    let closing: Promise<void> | undefined;
    return {
      close: () =>
        (closing ??= (async () => {
          await runtime.close();
        })()),
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

if (process.argv[1]?.endsWith("/main.ts")) {
  const runtime = await startWorkerProcess();
  const close = () => void runtime.close().then(() => process.exit(0));
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}
