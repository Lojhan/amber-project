import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import * as schema from "./schema/index.js";

/** The only PostgreSQL connection factory shared by runtime adapters. */
export const createDatabasePool = (connectionString: string): DatabasePool =>
  new Pool({ connectionString, max: 12, idleTimeoutMillis: 30_000 });

export type DatabasePool = Pool;
/** A checked-out PostgreSQL connection, used only by infrastructure adapters. */
export type DatabaseConnection = PoolClient;
export type DatabaseQueryRow = QueryResultRow;
export type DatabaseQueryResult = QueryResult;

/** The typed Drizzle client for the procurement schema. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * The typed value handed to a callback by Drizzle's `database.transaction`.
 * Deriving it from `Database` keeps it aligned with the installed Drizzle version.
 */
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/** Creates a schema-aware Drizzle client over either a pool or checked-out connection. */
export const createDatabase = (
  connection: DatabasePool | DatabaseConnection,
): Database => drizzle(connection, { schema });

export const checkDatabaseHealth = async (
  database: Database,
): Promise<void> => {
  await database.execute(sql`select 1`);
};
