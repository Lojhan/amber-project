import {
  foreignKey,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { quotations, quoteScenarios } from "./quotation.js";

/** The one explicit scenario selection for a quotation, scoped to its brand. */
export const quotationScenarioSelections = pgTable(
  "quotation_scenario_selection",
  {
    brandId: uuid("brand_id").notNull(),
    quotationId: uuid("quotation_id").notNull(),
    scenarioId: uuid("scenario_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.quotationId] }),
    foreignKey({
      columns: [t.brandId, t.quotationId],
      foreignColumns: [quotations.brandId, quotations.id],
      name: "scenario_selection_brand_quotation_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.scenarioId],
      foreignColumns: [quoteScenarios.brandId, quoteScenarios.id],
      name: "scenario_selection_brand_scenario_fk",
    }),
  ],
);
