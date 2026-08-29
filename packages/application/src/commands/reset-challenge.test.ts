import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { ResetChallengeCommandHandler } from "./reset-challenge.js";

describe("ResetChallengeCommandHandler", () => {
  it("clears brand state atomically before removing its uploaded objects", async () => {
    const reset = vi.fn().mockResolvedValue(["brand/quotation.xlsx"]);
    const remove = vi.fn().mockResolvedValue(undefined);
    const handler = new ResetChallengeCommandHandler({
      unitOfWork: {
        run: (work) => work({ id: "transaction" }),
      },
      resets: { reset },
      objects: { remove },
    });
    const context = {
      brandId: asBrandId("brand"),
      actorId: "actor",
      correlationId: "correlation",
    };

    await expect(
      handler.execute(context as never, {}),
    ).resolves.toBeUndefined();
    expect(reset).toHaveBeenCalledWith({ id: "transaction" }, context.brandId);
    expect(remove).toHaveBeenCalledWith({
      brandId: context.brandId,
      key: "brand/quotation.xlsx",
    });
  });
});
