import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { entityId } from "./helpers.js";

export const brands = pgTable(
  "brand",
  {
    brandId: uuid("brand_id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    displayName: text("display_name").notNull(),
  },
  (t) => [
    uniqueIndex("brand_key_unique").on(t.key),
    uniqueIndex("brand_id_unique").on(t.brandId),
  ],
);
export const products = pgTable(
  "product",
  {
    id: entityId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    catalogVersion: varchar("catalog_version", { length: 64 }).notNull(),
    sku: varchar("sku", { length: 128 }).notNull(),
    name: text("name"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("product_brand_id_unique").on(t.brandId, t.id),
    uniqueIndex("product_brand_version_sku_unique").on(
      t.brandId,
      t.catalogVersion,
      t.sku,
    ),
    index("product_brand_catalog_idx").on(t.brandId, t.catalogVersion),
    check("product_sku_nonempty", sql`length(${t.sku}) > 0`),
  ],
);
