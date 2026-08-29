import { describe, expect, it } from "vitest";
import {
  decisionProjectionSchema,
  decisionRequestSchema,
  hardConstraintsSchema,
  problemSchema,
  quotationUploadCommandSchema,
  quotationUploadReservationSchema,
} from "../src/index.js";

describe("remaining contract families", () => {
  it.each([{ maxLeadTimeDays: 1 }, { maxLeadTimeDays: 365 }, {}])(
    "accepts hard constraint %#",
    (input) =>
      expect(hardConstraintsSchema.safeParse(input).success).toBe(true),
  );
  it.each([
    { maxLeadTimeDays: 0 },
    { maxLeadTimeDays: 366 },
    { maxLeadTimeDays: 2, brandId: "solenne" },
  ])("rejects strict hard constraint %#", (input) =>
    expect(hardConstraintsSchema.safeParse(input).success).toBe(false),
  );
  it("requires strict decision request", () =>
    expect(
      decisionRequestSchema.safeParse({ negotiationId: "n", actorId: "x" })
        .success,
    ).toBe(false));
  it("accepts only the decision engine's auditable cost anchors", () => {
    const costAnchorSchema =
      decisionProjectionSchema.shape.decisionRecord.shape.anchors.shape.cost;

    expect(
      costAnchorSchema.safeParse({
        best: "0.92*baseline",
        worst: "1.15*baseline",
        bestMinor: "9200",
        worstMinor: "11500",
      }).success,
    ).toBe(true);
    expect(
      costAnchorSchema.safeParse({
        best: "0.91*baseline",
        worst: "1.15*baseline",
        bestMinor: "9100",
        worstMinor: "11500",
      }).success,
    ).toBe(false);
  });
  it("requires strict upload command", () =>
    expect(
      quotationUploadCommandSchema.safeParse({
        filename: "q.xlsx",
        contentType: "application/xlsx",
        idempotencyKey: "i",
        brandId: "x",
      }).success,
    ).toBe(false));
  it("accepts an exact upload reservation DTO", () =>
    expect(
      quotationUploadReservationSchema.safeParse({
        objectKey: "brand/key.xlsx",
        uploadUrl: "https://storage.example/upload",
        uploadMethod: "PUT",
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-amz-meta-sha256": "a".repeat(64),
        },
      }).success,
    ).toBe(true));
  it("rejects unknown problem fields", () =>
    expect(
      problemSchema.safeParse({
        type: "https://test.invalid/problem",
        title: "Problem",
        status: 400,
        actorId: "x",
      }).success,
    ).toBe(false));
});
