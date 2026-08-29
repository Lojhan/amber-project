import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { TransactionContext } from "../core/transaction-context.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  AuditWriter,
  Clock,
  ConfirmationTokenService,
  DomainEventWriter,
  HashingService,
  IdGenerator,
  PurchaseOrderRepository,
  PurchaseOrderSnapshot,
} from "../ports/index.js";
import {
  canonicalizeForDigest,
  purchaseOrderPreviewEvidence,
  purchaseOrderTotal,
} from "../purchase-order-digest.js";
import { assertIssuablePurchaseOrder } from "../purchase-order-validation.js";
import type { PreparePurchaseOrderInput } from "./prepare-purchase-order.js";

export type IssuePurchaseOrderInput = PreparePurchaseOrderInput &
  Readonly<{
    previewDigest: string;
    confirmationToken: string;
    idempotencyKey: string;
  }>;

export type IssuePurchaseOrderResult = Readonly<{
  id: string;
  number: string;
  replayed: boolean;
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  purchaseOrders: PurchaseOrderRepository;
  confirmationTokens: ConfirmationTokenService;
  hashing: HashingService;
  clock: Clock;
  audits: AuditWriter;
  events: DomainEventWriter;
  ids: IdGenerator;
}>;

export class IssuePurchaseOrderCommandHandler
  implements CommandHandler<IssuePurchaseOrderInput, IssuePurchaseOrderResult>
{
  constructor(private readonly dependencies: Dependencies) {}

  execute(
    context: RequestContext,
    input: IssuePurchaseOrderInput,
  ): Promise<IssuePurchaseOrderResult> {
    if (input.confirmationToken.length < 16)
      throw new ApplicationError(
        "confirmation-invalid",
        422,
        "Confirmation token is invalid",
      );

    const requestDigest = this.dependencies.hashing.sha256(
      canonicalizeForDigest({
        negotiationId: input.negotiationId,
        selectedOfferId: input.selectedOfferId,
        previewDigest: input.previewDigest,
        actorId: context.actorId,
      }),
    );

    return this.dependencies.unitOfWork.run((transaction) =>
      this.issue(transaction, context, input, requestDigest),
    );
  }

  private async issue(
    transaction: TransactionContext,
    context: RequestContext,
    input: IssuePurchaseOrderInput,
    requestDigest: string,
  ): Promise<IssuePurchaseOrderResult> {
    const replay = await this.dependencies.purchaseOrders.findByIdempotency(
      transaction,
      context.brandId,
      input.idempotencyKey,
    );

    if (replay) {
      if (replay.requestDigest !== requestDigest)
        throw new ApplicationError(
          "idempotency-conflict",
          409,
          "Idempotency key was already used for a different command",
        );

      return { id: replay.id, number: replay.number, replayed: true };
    }

    const { now, snapshot } = await this.loadAuthorizedSnapshot(
      transaction,
      context,
      input,
    );
    const digest = this.dependencies.hashing.sha256(
      purchaseOrderPreviewEvidence(snapshot),
    );

    this.verifyConfirmation(context, input, digest, now);

    return this.persist(transaction, context, input, snapshot, {
      requestDigest,
      previewDigest: digest,
    });
  }

  private async loadAuthorizedSnapshot(
    transaction: TransactionContext,
    context: RequestContext,
    input: IssuePurchaseOrderInput,
  ): Promise<Readonly<{ snapshot: PurchaseOrderSnapshot; now: Date }>> {
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

    return { snapshot, now };
  }

  private verifyConfirmation(
    context: RequestContext,
    input: IssuePurchaseOrderInput,
    digest: string,
    now: Date,
  ): void {
    if (digest !== input.previewDigest)
      throw new ApplicationError(
        "preview-stale",
        409,
        "Purchase order preview no longer matches current facts",
      );

    const valid = this.dependencies.confirmationTokens.verify(
      input.confirmationToken,
      {
        digest,
        negotiationId: input.negotiationId,
        offerId: input.selectedOfferId,
        brandId: context.brandId,
        actorId: context.actorId,
      },
      now,
    );

    if (!valid)
      throw new ApplicationError(
        "confirmation-invalid",
        409,
        "Confirmation token is invalid, stale, or belongs to another user",
      );
  }

  private async persist(
    transaction: TransactionContext,
    context: RequestContext,
    input: IssuePurchaseOrderInput,
    snapshot: PurchaseOrderSnapshot,
    digests: Readonly<{ requestDigest: string; previewDigest: string }>,
  ): Promise<IssuePurchaseOrderResult> {
    const id = this.dependencies.ids.next();
    const number = await this.dependencies.purchaseOrders.nextNumber(
      transaction,
      context.brandId,
    );
    const totalMinor = purchaseOrderTotal(snapshot);
    const inserted = await this.dependencies.purchaseOrders.insert(
      transaction,
      {
        id,
        brandId: context.brandId,
        number,
        actorId: context.actorId,
        idempotencyKey: input.idempotencyKey,
        requestDigest: digests.requestDigest,
        previewDigest: digests.previewDigest,
        totalMinor,
        snapshot,
      },
    );

    if (!inserted)
      throw new Error("purchase-order idempotency conflict was not replayable");

    await this.recordIssuance(transaction, context, input, {
      id,
      number,
      totalMinor,
      digest: digests.previewDigest,
    });

    return { id, number, replayed: false };
  }

  private async recordIssuance(
    transaction: TransactionContext,
    context: RequestContext,
    input: IssuePurchaseOrderInput,
    issued: Readonly<{
      id: string;
      number: string;
      totalMinor: bigint;
      digest: string;
    }>,
  ): Promise<void> {
    await this.dependencies.purchaseOrders.markNegotiationCommitted(
      transaction,
      context.brandId,
      input.negotiationId,
      "RECOMMENDED",
    );
    await this.dependencies.audits.record(transaction, {
      brandId: context.brandId,
      actorId: context.actorId,
      action: "purchase-order.issued",
      subjectId: issued.id,
      metadata: { digest: issued.digest },
    });
    await this.dependencies.events.append(transaction, {
      brandId: context.brandId,
      aggregateType: "purchase-order",
      aggregateId: issued.id,
      type: "purchase-order.issued",
      schemaVersion: "1",
      payload: {
        number: issued.number,
        totalMinor: issued.totalMinor.toString(),
      },
      correlationId: context.correlationId,
      idempotencyKey: `purchase-order:${context.brandId}:${input.idempotencyKey}`,
    });
  }
}
