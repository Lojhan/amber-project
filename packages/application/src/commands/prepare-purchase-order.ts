import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  Clock,
  ConfirmationTokenService,
  HashingService,
  PurchaseOrderRepository,
} from "../ports/index.js";
import {
  purchaseOrderPreviewEvidence,
  purchaseOrderTotal,
} from "../purchase-order-digest.js";
import { assertIssuablePurchaseOrder } from "../purchase-order-validation.js";

export type PreparePurchaseOrderInput = Readonly<{
  negotiationId: string;
  selectedOfferId: string;
}>;

export type PreparePurchaseOrderResult = Readonly<{
  digest: string;
  confirmationToken: string;
  totalMinor: string;
  currency: string;
  supplierId: string;
  lineCount: number;
  leadTimeDays: number;
  paymentSchedule: readonly Readonly<{
    milestone: "ORDER" | "PRE_SHIPMENT" | "DELIVERY";
    percentBasisPoints: number;
  }>[];
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  purchaseOrders: PurchaseOrderRepository;
  confirmationTokens: ConfirmationTokenService;
  hashing: HashingService;
  clock: Clock;
}>;

export class PreparePurchaseOrderCommandHandler
  implements
    CommandHandler<PreparePurchaseOrderInput, PreparePurchaseOrderResult>
{
  constructor(private readonly dependencies: Dependencies) {}

  execute(
    context: RequestContext,
    input: PreparePurchaseOrderInput,
  ): Promise<PreparePurchaseOrderResult> {
    return this.dependencies.unitOfWork.run(async (transaction) => {
      const snapshot =
        await this.dependencies.purchaseOrders.loadIssuableSnapshot(
          transaction,
          context.brandId,
          input.negotiationId,
        );

      if (!snapshot)
        throw new ApplicationError(
          "negotiation-not-found",
          404,
          "Negotiation not found",
        );
      if (snapshot.selectedOffer.id !== input.selectedOfferId)
        throw new ApplicationError(
          "offer-not-selected",
          409,
          "Offer is not the selected decision",
        );

      const now = this.dependencies.clock.now();
      assertIssuablePurchaseOrder(context, snapshot, now);
      const digest = this.dependencies.hashing.sha256(
        purchaseOrderPreviewEvidence(snapshot),
      );

      return {
        digest,
        confirmationToken: this.dependencies.confirmationTokens.issue(
          {
            digest,
            negotiationId: input.negotiationId,
            offerId: input.selectedOfferId,
            brandId: context.brandId,
            actorId: context.actorId,
          },
          now,
        ),
        totalMinor: purchaseOrderTotal(snapshot).toString(),
        currency: snapshot.selectedOffer.currency,
        supplierId: snapshot.selectedOffer.supplierId,
        lineCount: snapshot.selectedOffer.lines.length,
        leadTimeDays: snapshot.selectedOffer.leadTimeDays,
        paymentSchedule: snapshot.selectedOffer.paymentSchedule,
      };
    });
  }
}
