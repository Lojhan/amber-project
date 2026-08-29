import type { ScenarioSelectionRepository } from "@procurement/application/ports";
import {
  quotationScenarioSelections,
  quoteScenarios,
} from "@procurement/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

export class DrizzleScenarioSelectionRepository
  implements ScenarioSelectionRepository
{
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async selectedScenario(
    transaction: Parameters<ScenarioSelectionRepository["selectedScenario"]>[0],
    brandId: Parameters<ScenarioSelectionRepository["selectedScenario"]>[1],
    quotationId: string,
  ): Promise<string | null> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .select({ scenarioId: quotationScenarioSelections.scenarioId })
      .from(quotationScenarioSelections)
      .where(
        and(
          eq(quotationScenarioSelections.brandId, brandId),
          eq(quotationScenarioSelections.quotationId, quotationId),
        ),
      )
      .limit(1);
    return rows[0]?.scenarioId ?? null;
  }

  async selectScenario(
    transaction: Parameters<ScenarioSelectionRepository["selectScenario"]>[0],
    input: Parameters<ScenarioSelectionRepository["selectScenario"]>[1],
  ): Promise<boolean> {
    const database = this.unitOfWork.databaseFor(transaction);
    const source = database
      .select({
        brandId: quoteScenarios.brandId,
        quotationId: quoteScenarios.quotationId,
        scenarioId: quoteScenarios.id,
        actorId: sql<string>`${input.actorId}`.as("actor_id"),
        selectedAt: sql<Date>`now()`.as("selected_at"),
      })
      .from(quoteScenarios)
      .where(
        and(
          eq(quoteScenarios.brandId, input.brandId),
          eq(quoteScenarios.quotationId, input.quotationId),
          eq(quoteScenarios.id, input.scenarioId),
        ),
      );
    const rows = await database
      .insert(quotationScenarioSelections)
      .select(source)
      .onConflictDoUpdate({
        target: [
          quotationScenarioSelections.brandId,
          quotationScenarioSelections.quotationId,
        ],
        set: {
          scenarioId: input.scenarioId,
          actorId: input.actorId,
          selectedAt: new Date(),
        },
      })
      .returning({ scenarioId: quotationScenarioSelections.scenarioId });
    return rows.length === 1;
  }
}
