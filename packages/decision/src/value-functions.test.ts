import { describe, expect, it } from "vitest";
import { normalizedValues } from "./value-functions.js";

const baseline = 1_000_000n;
const candidate = (
  totalMinor: bigint,
  quality = 4.35,
  leadTimeDays = 33,
  preShipmentBps = 6500,
) => ({
  totalMinor,
  quality,
  leadTimeDays,
  preShipmentBps,
});
describe("value functions", () => {
  it("uses stated anchors and clamps bounds", () => {
    expect(
      normalizedValues(candidate(920_000n), baseline).cost.toString(),
    ).toBe("1");
    expect(
      normalizedValues(candidate(1_150_000n), baseline).cost.toString(),
    ).toBe("0");
    expect(
      normalizedValues(candidate(800_000n), baseline).cost.toString(),
    ).toBe("1");
    expect(
      normalizedValues(candidate(1_200_000n), baseline).cost.toString(),
    ).toBe("0");
    expect(
      normalizedValues(candidate(1_000_000n, 4.7), baseline).quality.toString(),
    ).toBe("1");
    expect(
      normalizedValues(candidate(1_000_000n, 3.9), baseline).quality.toString(),
    ).toBe("0");
    expect(
      normalizedValues(
        candidate(1_000_000n, 4.2, 12),
        baseline,
      ).lead.toString(),
    ).toBe("1");
    expect(
      normalizedValues(
        candidate(1_000_000n, 4.2, 70),
        baseline,
      ).lead.toString(),
    ).toBe("0");
    expect(
      normalizedValues(
        candidate(1_000_000n, 4.2, 30, 3000),
        baseline,
      ).payment.toString(),
    ).toBe("1");
    expect(
      normalizedValues(
        candidate(1_000_000n, 4.2, 30, 10000),
        baseline,
      ).payment.toString(),
    ).toBe("0");
  });
});
