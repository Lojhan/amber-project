import {
  OpenAICommercialNoteInterpreter,
  OpenAIQuoteCopilot,
} from "@procurement/agents";
import {
  checkDatabaseHealth,
  createDatabase,
  createDatabasePool,
  type Database,
  type DatabasePool,
} from "@procurement/db";
import { DrizzleUnitOfWork } from "@procurement/persistence/drizzle-unit-of-work";
import { PgBossQueue } from "@procurement/persistence/pg-boss-bridge";
import {
  DrizzleDecisionReadModel,
  DrizzleNegotiationPolicyReadModel,
  DrizzleNegotiationReadModel,
  DrizzleProjectionEventReadModel,
  DrizzlePurchaseOrderReadModel,
  DrizzleQuotationReadModel,
} from "@procurement/persistence/read-models";
import {
  DrizzleAuditWriter,
  DrizzleCatalogRepository,
  DrizzleChallengeResetRepository,
  DrizzleCommercialReviewRepository,
  DrizzleDomainEventWriter,
  DrizzleMatchingRepository,
  DrizzleNegotiationRepository,
  DrizzlePurchaseOrderRepository,
  DrizzleQuotationRepository,
  DrizzleQuoteCopilotRepository,
  DrizzleScenarioSelectionRepository,
} from "@procurement/persistence/repositories";
import { createS3Client, S3QuotationObjectStore } from "@procurement/storage";
import OpenAI from "openai";
import { type ApiComposition, composeApi } from "./api-composition.js";
import type { ProductionApiConfig } from "./production-config.js";
import {
  CryptoIdGenerator,
  HmacConfirmationTokenService,
  Sha256HashingService,
  SystemClock,
} from "./system-adapters.js";
import { workerQueueNames } from "./worker-queues.js";

export interface ProductionApiRuntime {
  readonly composition: ApiComposition;
  health(): Promise<void>;
  close(): Promise<void>;
}

const createObjects = (config: ProductionApiConfig) => {
  const storageConfig = {
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    bucket: config.S3_BUCKET,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  };

  return new S3QuotationObjectStore(
    createS3Client(storageConfig),
    storageConfig,
    createS3Client({
      ...storageConfig,
      ...(config.S3_PUBLIC_ENDPOINT
        ? { endpoint: config.S3_PUBLIC_ENDPOINT }
        : {}),
    }),
  );
};

const createReadModels = (database: Database) => ({
  quotations: new DrizzleQuotationReadModel(database),
  negotiations: new DrizzleNegotiationReadModel(database),
  decisions: new DrizzleDecisionReadModel(database),
  purchaseOrders: new DrizzlePurchaseOrderReadModel(database),
  policies: new DrizzleNegotiationPolicyReadModel(database),
  events: new DrizzleProjectionEventReadModel(database),
});

const copilotDependencies = (
  config: ProductionApiConfig,
  database: Database,
  unitOfWork: DrizzleUnitOfWork,
  views: ReturnType<typeof createReadModels>,
  clock: SystemClock,
  ids: CryptoIdGenerator,
) => {
  const conversations = new DrizzleQuoteCopilotRepository(database, unitOfWork);

  return {
    chatWithQuoteCopilot: {
      unitOfWork,
      quotations: views.quotations,
      negotiations: views.negotiations,
      decisions: views.decisions,
      purchaseOrders: views.purchaseOrders,
      conversations,
      model: new OpenAIQuoteCopilot(
        config.OPENAI_API_KEY,
        config.OPENAI_COPILOT_MODEL,
      ),
      ids,
      clock,
    },
    getQuoteCopilot: { quotations: views.quotations, conversations },
  };
};

const composeProductionApi = (
  config: ProductionApiConfig,
  database: Database,
  unitOfWork: DrizzleUnitOfWork,
  queue: PgBossQueue<Record<string, unknown>>,
): ApiComposition => {
  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const hashing = new Sha256HashingService();
  const objects = createObjects(config);
  const jobs = queue.scheduler(unitOfWork);
  const quotations = new DrizzleQuotationRepository(database, unitOfWork);
  const resets = new DrizzleChallengeResetRepository(unitOfWork);
  const catalog = new DrizzleCatalogRepository(unitOfWork);
  const matches = new DrizzleMatchingRepository(unitOfWork);
  const scenarios = new DrizzleScenarioSelectionRepository(unitOfWork);
  const commercialReview = new DrizzleCommercialReviewRepository(unitOfWork);
  const negotiations = new DrizzleNegotiationRepository(unitOfWork);
  const purchaseOrders = new DrizzlePurchaseOrderRepository(unitOfWork);
  const events = new DrizzleDomainEventWriter(unitOfWork);
  const audits = new DrizzleAuditWriter(unitOfWork);
  const views = createReadModels(database);
  const confirmationTokens = new HmacConfirmationTokenService(
    config.CONFIRMATION_SECRET,
  );
  const matchingDependencies = {
    unitOfWork,
    quotations,
    matches,
    scenarios,
    commercialReview,
  };
  const purchaseOrderDependencies = {
    unitOfWork,
    purchaseOrders,
    confirmationTokens,
    hashing,
    clock,
  };

  return composeApi({
    ...copilotDependencies(config, database, unitOfWork, views, clock, ids),
    resetChallenge: { unitOfWork, resets, objects },
    reserveQuotationUpload: objects,
    completeQuotationUpload: {
      unitOfWork,
      objects,
      quotations,
      catalog,
      events,
      jobs,
      ids,
    },
    resolveCatalogMatch: matchingDependencies,
    selectQuotationScenario: matchingDependencies,
    resolveRequestedQuantities: matchingDependencies,
    startNegotiation: {
      unitOfWork,
      negotiations,
      jobs,
      events,
      ids,
      scenarios,
      confirmationTokens,
      clock,
    },
    preparePurchaseOrder: purchaseOrderDependencies,
    issuePurchaseOrder: {
      ...purchaseOrderDependencies,
      audits,
      events,
      ids,
    },
    getQuotation: views.quotations,
    previewNegotiationPolicy: {
      policies: views.policies,
      interpreter: new OpenAICommercialNoteInterpreter(
        new OpenAI({ apiKey: config.OPENAI_API_KEY }),
      ),
      confirmationTokens,
      clock,
    },
    getNegotiation: views.negotiations,
    getDecision: views.decisions,
    purchaseOrders: views.purchaseOrders,
    readProjectionEvents: views.events,
  });
};

const runtimeFor = (
  composition: ApiComposition,
  database: Database,
  pool: DatabasePool,
  queue: PgBossQueue<Record<string, unknown>>,
): ProductionApiRuntime => {
  let closed = false;

  return {
    composition,
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

export const createProductionApiRuntime = async (
  config: ProductionApiConfig,
): Promise<ProductionApiRuntime> => {
  const pool = createDatabasePool(config.DATABASE_URL);
  const database = createDatabase(pool);
  const unitOfWork = new DrizzleUnitOfWork(pool);
  const queue = new PgBossQueue<Record<string, unknown>>(
    config.DATABASE_URL,
    (_name, data) => data as Record<string, unknown>,
  );

  try {
    await queue.start();
    await Promise.all(workerQueueNames.map((name) => queue.create(name)));

    return runtimeFor(
      composeProductionApi(config, database, unitOfWork, queue),
      database,
      pool,
      queue,
    );
  } catch (error) {
    await Promise.allSettled([queue.stop(), pool.end()]);
    throw error;
  }
};
