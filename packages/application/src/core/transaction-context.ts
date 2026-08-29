/**
 * Opaque application capability identifying one atomic unit of work.
 *
 * The identifier is meaningful only to persistence. It is deliberately not a
 * database client and cannot execute an operation itself.
 */
export type TransactionContext = Readonly<{ id: string }>;
