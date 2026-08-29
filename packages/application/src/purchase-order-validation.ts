import {
  validateOfferAgainstSupplierPolicy,
  validateOfferForIntent,
} from "@procurement/domain";
import type { RequestContext } from "./context.js";
import { ApplicationError } from "./errors.js";
import type { PurchaseOrderSnapshot } from "./ports/purchase-order.js";

export const assertIssuablePurchaseOrder = (
  context: RequestContext,
  snapshot: PurchaseOrderSnapshot,
  now: Date,
): void => {
  if (context.brandId !== snapshot.brandId)
    throw new ApplicationError(
      "brand-forbidden",
      403,
      "Resource is outside the active brand",
    );
  if (snapshot.negotiationState !== "RECOMMENDED")
    throw new ApplicationError(
      "invalid-state",
      409,
      `Expected RECOMMENDED, received ${snapshot.negotiationState}`,
    );

  if (!snapshot.eligible) {
    throw new ApplicationError(
      "offer-ineligible",
      409,
      "Selected offer is not eligible",
    );
  }
  try {
    validateOfferForIntent(snapshot.selectedOffer, snapshot.orderIntent, now);
    validateOfferAgainstSupplierPolicy(
      snapshot.selectedOffer.supplierId,
      snapshot.orderIntent,
      snapshot.selectedOffer,
    );
  } catch (error) {
    throw new ApplicationError(
      "offer-ineligible",
      409,
      error instanceof Error ? error.message : "Selected offer is not eligible",
    );
  }
};
