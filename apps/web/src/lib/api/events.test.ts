import { describe, expect, it } from "vitest";
import { pollUntil, projectionEventTypes } from "./events";

describe("projection event subscriptions", () => {
  it("invalidates for every durable negotiation audit change", () => {
    expect(projectionEventTypes).toEqual(
      expect.arrayContaining([
        "OfferSubmitted",
        "OfferRejected",
        "SupplierCapacityChanged",
      ]),
    );
  });
});

describe("pollUntil", () => {
  it("stops when the predicate succeeds", async () => {
    let count = 0;
    const value = await pollUntil(
      async () => ++count,
      (current) => current === 3,
      8,
    );
    expect(value).toBe(3);
    expect(count).toBe(3);
  });

  it("does not exceed the configured polling budget", async () => {
    let count = 0;
    await expect(
      pollUntil(
        async () => ++count,
        () => false,
        3,
      ),
    ).resolves.toBe(3);
    expect(count).toBe(3);
  });

  it("provides a bounded authoritative fallback after a reconnect failure", async () => {
    let refreshes = 0;
    const authoritative = await pollUntil(
      async () => ({ revision: ++refreshes, ready: refreshes === 2 }),
      (projection) => projection.ready,
      3,
    );
    expect(authoritative).toEqual({ revision: 2, ready: true });
    expect(refreshes).toBeLessThanOrEqual(3);
  });
});
