import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, createDatabasePool } from "./client.js";

/** Uses Drizzle's generated SQL journal, but avoids drizzle-kit's interactive
 * migration runner so this command is deterministic in CI and containers. */
export async function migrateDatabase(databaseUrl: string): Promise<void> {
  const pool = createDatabasePool(databaseUrl);
  try {
    await migrate(createDatabase(pool), {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  await migrateDatabase(databaseUrl);
}
