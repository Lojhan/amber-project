import { describe, expect, it } from "vitest";
import {
  addMoney,
  DomainInvariantError,
  money,
  multiplyMoney,
  roundMinorByBasisPoints,
} from "../src/index.js";

describe("money", () => {
  it.each([
    ["USD", 0n],
    ["EUR", 1n],
    ["BRL", 9_999_999_999n],
  ] as const)("creates exact %s minor units", (currency, minor) =>
    expect(money(currency, minor).minor).toBe(minor),
  );
  it("rejects negative values", () =>
    expect(() => money("USD", -1n)).toThrow(DomainInvariantError));
  it("adds matching currencies", () =>
    expect(addMoney(money("USD", 2n), money("USD", 3n)).minor).toBe(5n));
  it("rejects mixed currencies", () =>
    expect(() => addMoney(money("USD", 1n), money("EUR", 1n))).toThrow(
      "Currencies",
    ));
  it.each([0n, -1n])(
    "requires positive multiplication quantity %s",
    (quantity) =>
      expect(() => multiplyMoney(money("USD", 1n), quantity)).toThrow(
        "Quantity",
      ),
  );
  it("rounds a fractional minor-unit multiplier half up", () =>
    expect(roundMinorByBasisPoints(625n, 11_500)).toBe(719n));
  it("rejects a fractional basis-point multiplier", () =>
    expect(() => roundMinorByBasisPoints(625n, 11_500.5)).toThrow(
      DomainInvariantError,
    ));
});
