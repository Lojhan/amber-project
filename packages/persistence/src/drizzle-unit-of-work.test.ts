import type {
  Database,
  DatabaseConnection,
  DatabasePool,
  DatabaseTransaction,
} from "@procurement/db";
import { describe, expect, it, vi } from "vitest";
import { DrizzleUnitOfWork } from "./drizzle-unit-of-work.js";
import { transactionConnection } from "./pg-boss-transaction-access.js";

const poolHarness = () => {
  const release = vi.fn();
  const connection = { release } as unknown as DatabaseConnection;
  const pool = {
    connect: vi.fn(async () => connection),
  } as unknown as DatabasePool;
  const transactionDatabase = {} as DatabaseTransaction;
  const transaction = vi.fn(
    async <T>(work: (database: DatabaseTransaction) => Promise<T>) =>
      work(transactionDatabase),
  );
  const database = { transaction } as unknown as Database;

  return {
    database,
    pool,
    release,
    transaction,
    transactionDatabase,
  };
};

describe("DrizzleUnitOfWork", () => {
  it("reuses the outer opaque transaction for nested work", async () => {
    const { database, pool, release, transaction, transactionDatabase } =
      poolHarness();
    const unitOfWork = new DrizzleUnitOfWork(pool, () => database);
    let outerId = "";
    let innerId = "";

    await unitOfWork.run(async (outer) => {
      outerId = outer.id;
      const activeDatabase = unitOfWork.databaseFor(outer);
      await unitOfWork.run(async (inner) => {
        innerId = inner.id;
        expect(unitOfWork[transactionConnection](inner)).toBeDefined();
        expect(unitOfWork.databaseFor(inner)).toBe(activeDatabase);
      });
    });

    expect(innerId).toBe(outerId);
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledOnce();
    expect(transactionDatabase).toBeDefined();
    expect(release).toHaveBeenCalledOnce();
  });

  it("delegates rollback and rejects escaped tokens when work fails", async () => {
    const { database, pool, release, transaction } = poolHarness();
    const unitOfWork = new DrizzleUnitOfWork(pool, () => database);
    let escaped: { id: string } | undefined;

    await expect(
      unitOfWork.run(async (transaction) => {
        escaped = transaction;
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");

    expect(transaction).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(() => unitOfWork[transactionConnection](escaped!)).toThrow(
      "initiating transaction",
    );
  });
});
