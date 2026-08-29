import { describe, expect, it } from "vitest";
import { purchaseOrderCommandSchema } from "../src/index.js";

const command = {
  negotiationId: "n",
  selectedOfferId: "o",
  confirmationToken: "a".repeat(16),
};
describe("purchase order command", () => {
  it("accepts confirmation command", () =>
    expect(purchaseOrderCommandSchema.safeParse(command).success).toBe(true));
  it.each([
    { ...command, confirmationToken: "short" },
    { ...command, brandId: "solenne" },
    { ...command, actorId: "attacker" },
  ])("rejects incomplete or spoofed command", (input) =>
    expect(purchaseOrderCommandSchema.safeParse(input).success).toBe(false),
  );
});
