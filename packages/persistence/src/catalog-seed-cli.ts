import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDatabase, createDatabasePool } from "@procurement/db";
import { brands, products } from "@procurement/db/schema";
import { and, count, eq } from "drizzle-orm";
import { brandSeedIds, buildCatalogSeedPlan } from "./catalog-seed.js";

export async function seedCatalog(
  databaseUrl: string,
  csv: string,
): Promise<void> {
  const plan = buildCatalogSeedPlan(csv);
  const pool = createDatabasePool(databaseUrl);
  const database = createDatabase(pool);

  try {
    await database.transaction(async (transaction) => {
      for (const brand of ["valden", "solenne"] as const)
        await transaction
          .insert(brands)
          .values({
            brandId: brandSeedIds[brand],
            key: brand,
            displayName: brand[0]!.toUpperCase() + brand.slice(1),
          })
          .onConflictDoUpdate({
            target: brands.brandId,
            set: {
              key: brand,
              displayName: brand[0]!.toUpperCase() + brand.slice(1),
            },
          });
      for (const row of plan.rows)
        await transaction
          .insert(products)
          .values({
            id: row.id,
            brandId: row.brandId,
            catalogVersion: plan.catalogVersion,
            sku: row.sku,
            name: row.name,
            color: row.color,
          })
          .onConflictDoUpdate({
            target: [products.brandId, products.catalogVersion, products.sku],
            set: { name: row.name, color: row.color },
          });
      for (const brand of ["valden", "solenne"] as const) {
        const result = await transaction
          .select({ value: count() })
          .from(products)
          .where(
            and(
              eq(products.brandId, brandSeedIds[brand]),
              eq(products.catalogVersion, plan.catalogVersion),
            ),
          );
        const value = result[0]?.value;
        if (value === undefined || value !== plan.counts[brand])
          throw new Error(`catalog row count mismatch for ${brand}`);
      }
    });
  } finally {
    await pool.end();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  await seedCatalog(
    databaseUrl,
    await readFile(new URL("../../../products.csv", import.meta.url), "utf8"),
  );
}
