import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import type { DecisionPolicySnapshot, SerializedWeights } from "./types.js";

const criteria = ["cost", "quality", "lead", "payment"] as const;
export const deriveDecisionPolicy = (
  base: DecisionPolicySnapshot,
  change: Readonly<{
    weights: SerializedWeights;
    hardMaxLead?: number;
    noteConstraintIds: readonly string[];
  }>,
): DecisionPolicySnapshot => {
  if (
    change.hardMaxLead !== undefined &&
    (!Number.isInteger(change.hardMaxLead) ||
      change.hardMaxLead <= 0 ||
      change.hardMaxLead > 55)
  )
    throw new Error("hardMaxLead must be an integer between 1 and 55");
  for (const criterion of criteria) {
    if (
      new Decimal(change.weights[criterion])
        .sub(base.weights[criterion])
        .abs()
        .gt("0.15")
    )
      throw new Error(
        "note-derived weight change exceeds 15 percentage points",
      );
  }
  const total = criteria.reduce(
    (sum, criterion) => sum.add(change.weights[criterion]),
    new Decimal(0),
  );
  if (!total.equals(1)) throw new Error("derived weights must sum to one");
  const body = {
    version: `${base.version}:note-v1`,
    weights: change.weights,
    ...(change.hardMaxLead === undefined
      ? {}
      : { hardMaxLead: change.hardMaxLead }),
    derivedFrom: {
      version: base.version,
      hash: base.hash,
      noteConstraintIds: change.noteConstraintIds,
    },
  };
  return {
    ...body,
    hash: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };
};
