import { randomUUID } from "node:crypto";
import {
  createDatabase,
  createDatabasePool,
  type Database,
  type DatabasePool,
} from "@procurement/db";
import { brands, matchDecisions, products } from "@procurement/db/schema";
import { asActorId, asBrandId } from "@procurement/domain";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { DrizzleQuotationReadModel } from "../read-models/quotation.js";
import { DrizzleMatchingRepository } from "./matching.js";
import { DrizzleQuotationRepository } from "./quotation.js";
import { DrizzleScenarioSelectionRepository } from "./scenario-selection.js";
import { DrizzleUploadRepository } from "./upload.js";

const databaseUrl = process.env.PERSISTENCE_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;
const brandId = asBrandId(randomUUID());
const otherBrandId = asBrandId(randomUUID());
const actorId = asActorId(randomUUID());
const quotationId = randomUUID();
const scenarioId = randomUUID();
const parsedLineId = randomUUID();
const productId = randomUUID();
const objectKey = `uploads/${quotationId}/quote.xlsx`;
const contentHash = "a".repeat(64);

let pool: DatabasePool;
let database: Database;
let unitOfWork: DrizzleUnitOfWork;

const setupDatabase = async () => {
  if (!databaseUrl)
    throw new Error("PERSISTENCE_TEST_DATABASE_URL is required");
  pool = createDatabasePool(databaseUrl);
  database = createDatabase(pool);
  unitOfWork = new DrizzleUnitOfWork(pool);

  await database.insert(brands).values([
    { brandId, key: `integration-${brandId}`, displayName: "Integration" },
    {
      brandId: otherBrandId,
      key: `integration-${otherBrandId}`,
      displayName: "Other integration",
    },
  ]);
  await database.insert(products).values({
    id: productId,
    brandId,
    catalogVersion: "integration-v1",
    sku: "SKU-INTEGRATION",
    name: "Integration product",
    color: "Amber",
  });
};

const persistParsedQuotation = async () => {
  const quotations = new DrizzleQuotationRepository(database, unitOfWork);
  const generatedIds = [scenarioId, parsedLineId];
  const uploads = new DrizzleUploadRepository(
    database,
    unitOfWork,
    () => generatedIds.shift() ?? randomUUID(),
  );
  const matching = new DrizzleMatchingRepository(unitOfWork);
  const job = { brandId, quotationId, objectKey, correlationId: randomUUID() };

  await unitOfWork.run(async (transaction) => {
    await quotations.insert(transaction, {
      id: quotationId,
      brandId,
      state: "UPLOADED",
      objectKey,
      contentHash,
      catalogVersion: "integration-v1",
      note: null,
      idempotencyKey: `complete-${quotationId}`,
    });
    await uploads.finishPreflight(transaction, job, true);
    await uploads.persistParsedQuotation(transaction, job, {
      requiresInterpretation: false,
      scenarios: [
        {
          sourceSheet: "Quote",
          rationale: "single valid interpretation",
          metadata: {},
          lines: [
            {
              sourceEvidence: { row: 2 },
              normalizedCandidates: {
                sku: { value: "SKU-INTEGRATION" },
                description: { value: "Integration product" },
                quantityCandidates: [{ value: "10" }],
                unitPriceCandidates: [{ value: "95" }],
              },
              rawValue: "SKU-INTEGRATION",
            },
          ],
        },
      ],
    });
    await uploads.finishParse(transaction, job, "REVIEW_REQUIRED");
    expect(
      await matching.listCandidateInputs(transaction, brandId, quotationId),
    ).toEqual([
      expect.objectContaining({
        parsedLineId,
        catalogVersion: "integration-v1",
        rawSku: "SKU-INTEGRATION",
      }),
    ]);
    await matching.appendCandidate(transaction, {
      brandId,
      parsedLineId,
      candidates: {
        status: "matched",
        candidates: [{ product: { id: productId }, score: 1 }],
      },
      selectedProductId: productId,
    });
  });

  return { quotations, uploads, matching, job };
};

const resolveAndSelect = async (
  matching: DrizzleMatchingRepository,
  selections: DrizzleScenarioSelectionRepository,
) => {
  const initialFact = await database
    .select({ id: matchDecisions.id })
    .from(matchDecisions)
    .where(
      and(
        eq(matchDecisions.brandId, brandId),
        eq(matchDecisions.parsedLineId, parsedLineId),
        isNull(matchDecisions.actorId),
      ),
    )
    .limit(1);
  expect(initialFact[0]).toBeDefined();

  await unitOfWork.run(async (transaction) => {
    expect(
      await matching.resolve(transaction, {
        brandId,
        actorId,
        quotationId,
        scenarioId,
        matchId: initialFact[0]?.id ?? "missing",
        action: "accept",
      }),
    ).toEqual({ scenarioId });
    expect(
      await matching.resolutionSummary(
        transaction,
        brandId,
        quotationId,
        scenarioId,
      ),
    ).toEqual({ unresolved: 0, included: 1 });
    expect(
      await selections.selectScenario(transaction, {
        brandId,
        quotationId,
        scenarioId,
        actorId,
      }),
    ).toBe(true);
    expect(
      await selections.selectedScenario(transaction, brandId, quotationId),
    ).toBe(scenarioId);
    expect(
      await selections.selectScenario(transaction, {
        brandId: otherBrandId,
        quotationId,
        scenarioId,
        actorId,
      }),
    ).toBe(false);
  });
};

const verifyRepositoryWorkflow = async () => {
  const { quotations, uploads, matching, job } = await persistParsedQuotation();
  await resolveAndSelect(
    matching,
    new DrizzleScenarioSelectionRepository(unitOfWork),
  );

  expect(
    await new DrizzleQuotationReadModel(database).get(brandId, quotationId),
  ).toMatchObject({ selectedScenarioId: scenarioId });

  expect(
    await quotations.findByContentHash(otherBrandId, contentHash),
  ).toBeNull();
  expect(await uploads.loadParseTarget(job)).toMatchObject({
    state: "REVIEW_REQUIRED",
    scenarioCount: 1,
  });
};

const verifyRollbackAndOptimisticLock = async () => {
  const quotations = new DrizzleQuotationRepository(database, unitOfWork);
  const rollbackId = randomUUID();
  const optimisticId = randomUUID();

  await expect(
    unitOfWork.run(async (transaction) => {
      await quotations.insert(transaction, {
        id: rollbackId,
        brandId,
        state: "UPLOADED",
        objectKey: `uploads/${rollbackId}`,
        contentHash: "b".repeat(64),
        catalogVersion: "integration-v1",
        note: null,
        idempotencyKey: `rollback-${rollbackId}`,
      });
      throw new Error("force rollback");
    }),
  ).rejects.toThrow("force rollback");
  expect(
    await quotations.findReservation(brandId, `rollback-${rollbackId}`),
  ).toBeNull();

  await unitOfWork.run(async (transaction) => {
    const inserted = await quotations.insert(transaction, {
      id: optimisticId,
      brandId,
      state: "UPLOADED",
      objectKey: `uploads/${optimisticId}`,
      contentHash: "c".repeat(64),
      catalogVersion: "integration-v1",
      note: null,
      idempotencyKey: `optimistic-${optimisticId}`,
    });
    await quotations.transition(transaction, {
      brandId,
      id: optimisticId,
      expectedVersion: inserted.version,
      nextState: "PARSING",
    });
    await expect(
      quotations.transition(transaction, {
        brandId,
        id: optimisticId,
        expectedVersion: inserted.version,
        nextState: "PARSING",
      }),
    ).rejects.toThrow("quotation version conflict");
  });
};

postgres("typed Drizzle repository integration", () => {
  beforeAll(setupDatabase);
  afterAll(async () => pool?.end());

  it("persists tenant-scoped upload, matching, and scenario facts", async () => {
    await verifyRepositoryWorkflow();
  });

  it("rolls back and rejects stale optimistic transitions", async () => {
    await verifyRollbackAndOptimisticLock();
  });
});
