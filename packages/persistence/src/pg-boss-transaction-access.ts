import type { TransactionContext } from "@procurement/application/core";
import type { DatabaseConnection } from "@procurement/db";

/** Package-private raw connection capability used only by the pg-boss bridge. */
export const transactionConnection = Symbol("transactionConnection");

export interface TransactionConnectionResolver {
  [transactionConnection](transaction: TransactionContext): DatabaseConnection;
}
