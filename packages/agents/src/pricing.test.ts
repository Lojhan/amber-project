import { describe, expect, it } from "vitest";
import {
  asBasisPoints,
  asMinorAmount,
  roundHalfUpBasisPoints,
} from "./pricing.js";

describe("roundHalfUpBasisPoints", () => {
  it("rounds a fractional cent up at the half boundary", () =>
    expect(
      roundHalfUpBasisPoints(asMinorAmount(101n), asBasisPoints(9_950)),
    ).toBe(100n));
  it("rounds below a half down", () =>
    expect(
      roundHalfUpBasisPoints(asMinorAmount(101n), asBasisPoints(9_800)),
    ).toBe(99n));
  it("handles exact integer prices", () =>
    expect(
      roundHalfUpBasisPoints(asMinorAmount(100n), asBasisPoints(9_400)),
    ).toBe(94n));
  it("rejects a fractional multiplier", () =>
    expect(() => asBasisPoints(9_400.5)).toThrow(RangeError));
  it("rejects an out-of-range multiplier", () =>
    expect(() => asBasisPoints(-1)).toThrow(RangeError));
  it("rejects a negative minor amount", () =>
    expect(() => asMinorAmount(-1n)).toThrow(RangeError));
});
