import type {
  CatalogProduct,
  CatalogRepository,
} from "@procurement/application/ports";
import { products } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, desc, eq } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async currentVersion(
    transaction: Parameters<CatalogRepository["currentVersion"]>[0],
    brandId: BrandId,
  ): Promise<string | null> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .select({ catalogVersion: products.catalogVersion })
      .from(products)
      .where(eq(products.brandId, brandId))
      .orderBy(desc(products.createdAt), desc(products.catalogVersion))
      .limit(1);

    return rows[0]?.catalogVersion ?? null;
  }

  async listVersion(
    transaction: Parameters<CatalogRepository["listVersion"]>[0],
    brandId: BrandId,
    catalogVersion: string,
  ): Promise<readonly CatalogProduct[]> {
    return this.unitOfWork
      .databaseFor(transaction)
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        color: products.color,
      })
      .from(products)
      .where(
        and(
          eq(products.brandId, brandId),
          eq(products.catalogVersion, catalogVersion),
        ),
      );
  }
}
