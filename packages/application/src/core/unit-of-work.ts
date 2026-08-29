import type { TransactionContext } from "./transaction-context.js";

export interface UnitOfWork {
  run<T>(work: (transaction: TransactionContext) => Promise<T>): Promise<T>;
}

/** Alias used by composition roots that name the boundary as a port. */
export type UnitOfWorkPort = UnitOfWork;
