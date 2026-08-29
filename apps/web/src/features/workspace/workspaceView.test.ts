import { describe, expect, it } from "vitest";
import type { WorkspaceState } from "./types";
import { recoverableExcludedMatches } from "./workspaceView";

const scenarioId = "00000000-0000-4000-8000-000000000001";

const stateWithReasons = (
  reasons: NonNullable<
    WorkspaceState["quotation"]
  >["matches"][number]["reviewReasons"],
): WorkspaceState => ({
  loading: false,
  stale: false,
  purchaseOrders: [],
  selectedScenarioId: scenarioId,
  quotation: {
    id: "00000000-0000-4000-8000-000000000002",
    status: "READY",
    scenarios: [{ id: scenarioId, label: "Quote" }],
    matches: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        lineId: "00000000-0000-4000-8000-000000000004",
        scenarioId,
        label: "SKU-1",
        matchReady: true,
        status: "EXCLUDED",
        reviewReasons: reasons,
        candidates: [
          {
            productId: "00000000-0000-4000-8000-000000000005",
            sku: "SKU-1",
            name: "Product",
            score: 1,
          },
        ],
      },
    ],
  },
});

describe("excluded-line recovery", () => {
  it("offers rows whose missing quantity can be supplied", () => {
    expect(
      recoverableExcludedMatches(
        stateWithReasons(["missing_requested_quantity"]),
      ),
    ).toHaveLength(1);
  });

  it.each(["missing_unit_price", "ambiguous_commercial_fields"] as const)(
    "does not offer a row blocked by %s",
    (reason) => {
      expect(recoverableExcludedMatches(stateWithReasons([reason]))).toEqual(
        [],
      );
    },
  );
});
