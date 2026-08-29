import { describe, expect, it } from "vitest";
import { brandKeySchema, idSchema, moneySchema } from "../src/index.js";

describe("common contracts", () => {
  it.each(["a", "x".repeat(128)])("accepts bounded IDs", (id) =>
    expect(idSchema.safeParse(id).success).toBe(true),
  );
  it.each(["", "x".repeat(129)])("rejects invalid IDs", (id) =>
    expect(idSchema.safeParse(id).success).toBe(false),
  );
  it.each(["valden", "brand-2"])("accepts brand key %s", (key) =>
    expect(brandKeySchema.safeParse(key).success).toBe(true),
  );
  it.each(["Valden", "2brand", "brand_"])("rejects brand spoof/key %s", (key) =>
    expect(brandKeySchema.safeParse(key).success).toBe(false),
  );
  it("rejects unknown money keys", () =>
    expect(
      moneySchema.safeParse({ currency: "USD", minor: "1", actorId: "x" })
        .success,
    ).toBe(false));
});
