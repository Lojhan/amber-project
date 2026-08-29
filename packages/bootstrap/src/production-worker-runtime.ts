import {
  OpenAIBrandNegotiator,
  OpenAINegotiationModel,
  OpenAIProposalModelAdapter,
} from "@procurement/agents";
import { makeDecision } from "@procurement/application";
import {
  checkDatabaseHealth,
  createDatabase,
  createDatabasePool,
  type Database,
  type DatabasePool,
} from "@procurement/db";
import {
  IsolatedWorkbookParser,
  ParserCatalogMatcher,
} from "@procurement/parser";
import { DrizzleUnitOfWork } from "@procurement/persistence/drizzle-unit-of-work";
import { PgBossQueue } from "@procurement/persistence/pg-boss-bridge";
import {
  DrizzleCatalogRepository,
  DrizzleDomainEventWriter,
  DrizzleMatchingRepository,
  DrizzleNegotiationRepository,
  DrizzleUploadRepository,
  DrizzleWorkerExecutionRepository,
} from "@procurement/persistence/repositories";
import { createS3Client, S3QuotationObjectStore } from "@procurement/storage";
import OpenAI from "openai";
import type { ProductionWorkerConfig } from "./production-config.js";
import { Sha256HashingService } from "./system-adapters.js";
import { composeWorker, type WorkerComposition } from "./worker-composition.js";
import { type WorkerQueueName, workerQueueNames } from "./worker-queues.js";

export type { WorkerQueueName } from "./worker-queues.js";

type RawPayloadMap = { readonly [Name in WorkerQueueName]: unknown };

export type WorkerQueueJob = Readonly<{
  id: string;
  name: WorkerQueueName;
  data: unknown;
}>;

export interface ProductionWorkerQueue {
  start(): Promise<void>;
  work(
    name: WorkerQueueName,
    handler: (job: WorkerQueueJob) => Promise<unknown>,
  ): Promise<void>;
  stop(): Promise<void>;
}

export interface ProductionWorkerRuntime {
  readonly composition: WorkerComposition;
  readonly queue: ProductionWorkerQueue;
  health(): Promise<void>;
  close(): Promise<void>;
}

const createObjects = (config: ProductionWorkerConfig) => {
  const storageConfig = {
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    bucket: config.S3_BUCKET,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  };

  return new S3QuotationObjectStore(
    createS3Client(storageConfig),
    storageConfig,
  );
};

const composeProductionWorker = (
  config: ProductionWorkerConfig,
  database: Database,
  unitOfWork: DrizzleUnitOfWork,
  boss: PgBossQueue<RawPayloadMap>,
): WorkerComposition => {
  const objects = createObjects(config);
  const uploads = new DrizzleUploadRepository(database, unitOfWork);
  const matches = new DrizzleMatchingRepository(unitOfWork);
  const catalog = new DrizzleCatalogRepository(unitOfWork);
  const negotiations = new DrizzleNegotiationRepository(unitOfWork);
  const executions = new DrizzleWorkerExecutionRepository(unitOfWork);
  const events = new DrizzleDomainEventWriter(unitOfWork);
  const parser = new IsolatedWorkbookParser();
  const proposals = new OpenAIProposalModelAdapter(
    new OpenAINegotiationModel(new OpenAI({ apiKey: config.OPENAI_API_KEY })),
  );
  const brand = new OpenAIBrandNegotiator(
    config.OPENAI_API_KEY,
    config.OPENAI_COPILOT_MODEL,
  );
  const jobs = boss.scheduler(unitOfWork);

  return composeWorker({
    completeQuotationPreflight: {
      objects,
      parser,
      uploads,
      jobs,
      unitOfWork,
    },
    parseQuotation: {
      objects,
      parser,
      uploads,
      jobs,
      events,
      hashing: new Sha256HashingService(),
      unitOfWork,
    },
    generateMatchCandidates: {
      matches,
      catalog,
      matcher: new ParserCatalogMatcher(),
      unitOfWork,
    },
    executeNegotiationTurn: {
      unitOfWork,
      negotiations,
      brand,
      proposals,
      jobs,
    },
    continueDecision: {
      negotiations,
      unitOfWork,
      decide: makeDecision,
      events,
    },
    executions: [executions, unitOfWork],
    recordFailure: [executions, unitOfWork],
  });
};

const createQueue = (boss: PgBossQueue<RawPayloadMap>) => {
  let started = false;

  return {
    async start() {
      if (started) return;
      await boss.start();
      await Promise.all(workerQueueNames.map((name) => boss.create(name)));
      started = true;
    },
    work(
      name: WorkerQueueName,
      handler: (job: WorkerQueueJob) => Promise<unknown>,
    ) {
      return boss.work(name, (job) => handler(job));
    },
    async stop() {
      if (!started) return;
      started = false;
      await boss.stop();
    },
  } satisfies ProductionWorkerQueue;
};

const runtimeFor = (
  composition: WorkerComposition,
  queue: ProductionWorkerQueue,
  database: Database,
  pool: DatabasePool,
): ProductionWorkerRuntime => {
  let closed = false;

  return {
    composition,
    queue,
    async health() {
      await checkDatabaseHealth(database);
    },
    async close() {
      if (closed) return;
      closed = true;
      await queue.stop();
      await pool.end();
    },
  };
};

export const createProductionWorkerRuntime = (
  config: ProductionWorkerConfig,
): ProductionWorkerRuntime => {
  const pool = createDatabasePool(config.DATABASE_URL);
  const database = createDatabase(pool);
  const unitOfWork = new DrizzleUnitOfWork(pool);
  const boss = new PgBossQueue<RawPayloadMap>(
    config.DATABASE_URL,
    (_name, data) => data,
  );
  const composition = composeProductionWorker(
    config,
    database,
    unitOfWork,
    boss,
  );

  return runtimeFor(composition, createQueue(boss), database, pool);
};
