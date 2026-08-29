import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  matchDecisions,
  negotiationTurns,
  offerLineFulfillments,
  offers,
  orderIntentLines,
  projectionEvents,
  quotationLineQuantities,
  quoteCopilotMessages,
} from "./index.js";

const migrationFiles = readdirSync(join(process.cwd(), "drizzle"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
if (!migrationFiles.length) throw new Error("database migration is missing");
const migration = migrationFiles
  .map((file) => readFileSync(join(process.cwd(), "drizzle", file), "utf8"))
  .join("\n");
const journal = JSON.parse(
  readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
) as { entries: Array<{ idx: number; tag: string }> };

describe("database migration metadata", () => {
  it("journals every migration SQL exactly once and in order", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      migrationFiles.map((_, index) => index),
    );
    expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(
      migrationFiles,
    );
  });
});

describe("database schema metadata (no live Postgres required)", () => {
  it.each([
    "quote_scenario_brand_quotation_fk",
    "parsed_quote_line_brand_scenario_fk",
    "match_decision_brand_line_fk",
    "match_decision_brand_product_fk",
    "order_intent_line_brand_product_fk",
    "offer_brand_negotiation_fk",
    "offer_line_brand_offer_fk",
    "negotiation_turn_brand_negotiation_fk",
    "recommendation_brand_negotiation_fk",
    "purchase_order_brand_offer_fk",
    "projection_event_brand_domain_event_fk",
    "quote_copilot_message_brand_quotation_fk",
  ])("has the tenant composite foreign key %s", (name) =>
    expect(migration).toContain(
      `CONSTRAINT "${name}" FOREIGN KEY ("brand_id",`,
    ),
  );

  it("rejects an unmatched selection with XOR", () =>
    expect(migration).toContain(
      'CONSTRAINT "match_decision_selected_xor_excluded" CHECK',
    ));
  it("requires positive order quantities", () =>
    expect(migration).toContain("order_intent_line_quantity_positive"));
  it("requires positive buyer-reviewed quantities", () =>
    expect(migration).toContain("quotation_line_quantity_positive"));
  it("requires positive offer prices", () =>
    expect(migration).toContain("offer_line_price_positive"));
  it("bounds offer capacity", () =>
    expect(migration).toContain("offer_capacity_percent_valid"));
  it("deduplicates offer product lines", () =>
    expect(migration).toContain("offer_line_product_unique"));
  it("has a monotonic SSE identity", () =>
    expect(migration).toContain(
      '"resume_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY',
    ));
  it("includes immutable purchase order snapshots", () =>
    expect(migration).toContain('"immutable_snapshot" jsonb NOT NULL'));
  it("creates each composite referenced key before its foreign key", () => {
    const foreignKeys = migration.matchAll(
      /ALTER TABLE "[^"]+" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("brand_id","[^"]+"\) REFERENCES "public"\."([^"]+)"\("brand_id","id"\)/g,
    );
    for (const foreignKey of foreignKeys) {
      const table = foreignKey[1]!;
      const foreignKeyOffset = foreignKey.index!;
      const tableStart = migration.indexOf(`CREATE TABLE "${table}"`);
      const definitionBeforeForeignKey = migration.slice(
        tableStart,
        foreignKeyOffset,
      );
      expect(definitionBeforeForeignKey).toMatch(
        new RegExp(
          `(?:UNIQUE\\(\\"brand_id\\",\\"id\\"\\)|CREATE UNIQUE INDEX \\"${table}_brand_id_unique\\")`,
        ),
      );
    }
  });
  it("exposes required columns through Drizzle", () => {
    expect(matchDecisions.selectedProductId.name).toBe("selected_product_id");
    expect(offers.capacityPercent.name).toBe("capacity_percent");
    expect(negotiationTurns.turnKey.name).toBe("turn_key");
    expect(offerLineFulfillments.fulfillableQuantity.name).toBe(
      "fulfillable_quantity",
    );
    expect(orderIntentLines.quantity.name).toBe("quantity");
    expect(projectionEvents.resumeId.name).toBe("resume_id");
    expect(quotationLineQuantities.requestedQuantity.name).toBe(
      "requested_quantity",
    );
    expect(quoteCopilotMessages.suggestions.name).toBe("suggestions");
  });
});
