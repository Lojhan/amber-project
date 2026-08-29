import { describe, expect, it } from "vitest";
import { formatMoney } from "./formatMoney";

describe("formatMoney", () => {
  it("groups totals and always renders two minor-unit digits", () => {
    expect(formatMoney("146895000", "USD")).toBe("USD 1,468,950.00");
    expect(formatMoney("128708001", "USD")).toBe("USD 1,287,080.01");
  });

  it("keeps values above Number.MAX_SAFE_INTEGER exact", () => {
    expect(formatMoney("900719925474099301", "EUR")).toBe(
      "EUR 9,007,199,254,740,993.01",
    );
  });
});
