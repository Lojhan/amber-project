import type {
  QuoteCopilotMessage,
  QuoteCopilotRepository,
} from "@procurement/application/ports";
import type { Database } from "@procurement/db";
import { quoteCopilotMessages } from "@procurement/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { decodeCopilotSuggestions } from "./copilot-codecs.js";

export class DrizzleQuoteCopilotRepository implements QuoteCopilotRepository {
  constructor(
    private readonly database: Database,
    private readonly unitOfWork: DrizzleUnitOfWork,
  ) {}

  async list(
    brandId: Parameters<QuoteCopilotRepository["list"]>[0],
    quotationId: string,
    limit: number,
  ): Promise<readonly QuoteCopilotMessage[]> {
    const rows = await this.database
      .select()
      .from(quoteCopilotMessages)
      .where(
        and(
          eq(quoteCopilotMessages.brandId, brandId),
          eq(quoteCopilotMessages.quotationId, quotationId),
        ),
      )
      .orderBy(
        desc(quoteCopilotMessages.createdAt),
        asc(quoteCopilotMessages.role),
        desc(quoteCopilotMessages.id),
      )
      .limit(limit);

    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role === "user" ? "user" : "assistant",
      content: row.content,
      suggestions: decodeCopilotSuggestions(row.suggestions),
      createdAt: row.createdAt,
    }));
  }

  async append(
    transaction: Parameters<QuoteCopilotRepository["append"]>[0],
    input: Parameters<QuoteCopilotRepository["append"]>[1],
  ): Promise<void> {
    await this.unitOfWork
      .databaseFor(transaction)
      .insert(quoteCopilotMessages)
      .values(
        input.messages.map((message) => ({
          id: message.id,
          brandId: input.brandId,
          quotationId: input.quotationId,
          role: message.role,
          content: message.content,
          suggestions: message.suggestions,
          createdAt: message.createdAt,
        })),
      );
  }
}
