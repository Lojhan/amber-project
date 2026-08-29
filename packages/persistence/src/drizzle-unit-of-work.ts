import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type {
  TransactionContext,
  UnitOfWork,
} from "@procurement/application/core";
import {
  createDatabase,
  type Database,
  type DatabaseConnection,
  type DatabasePool,
  type DatabaseTransaction,
} from "@procurement/db";
import {
  type TransactionConnectionResolver,
  transactionConnection,
} from "./pg-boss-transaction-access.js";

type ActiveTransaction = Readonly<{
  id: string;
  connection: DatabaseConnection;
  database: DatabaseTransaction;
}>;

type DatabaseFactory = (connection: DatabaseConnection) => Database;

/**
 * Infrastructure implementation of the application's opaque transaction boundary.
 *
 * The application receives only `{ id }`. Drizzle and PostgreSQL connections remain
 * private to persistence, where repositories can resolve them while a unit of work
 * is active. Nested work joins the already-open transaction intentionally: a nested
 * application use case must commit or roll back with its outer use case.
 */
export class DrizzleUnitOfWork
  implements UnitOfWork, TransactionConnectionResolver
{
  private readonly active = new AsyncLocalStorage<ActiveTransaction>();

  constructor(
    private readonly pool: DatabasePool,
    private readonly databaseFactory: DatabaseFactory = createDatabase,
  ) {}

  async run<T>(
    work: (transaction: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const active = this.active.getStore();
    if (active) return work({ id: active.id });

    const connection = await this.pool.connect();
    const database = this.databaseFactory(connection);

    try {
      return await database.transaction(async (transactionDatabase) => {
        const transaction: ActiveTransaction = {
          id: randomUUID(),
          connection,
          database: transactionDatabase,
        };

        return this.active.run(transaction, () => work({ id: transaction.id }));
      });
    } finally {
      connection.release();
    }
  }

  /** Package-private escape hatch keyed by an unexported public-package symbol. */
  [transactionConnection](transaction: TransactionContext): DatabaseConnection {
    const active = this.requireActive(transaction);
    return active.connection;
  }

  /** Resolves the schema-aware Drizzle database without exposing it to application code. */
  databaseFor(transaction: TransactionContext): DatabaseTransaction {
    return this.requireActive(transaction).database;
  }

  private requireActive(transaction: TransactionContext): ActiveTransaction {
    const active = this.active.getStore();
    if (!active || active.id !== transaction.id) {
      throw new Error("Database operation requires its initiating transaction");
    }
    return active;
  }
}
