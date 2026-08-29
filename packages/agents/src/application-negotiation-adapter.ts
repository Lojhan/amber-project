import type {
  JsonValue,
  SupplierProposalContext,
  SupplierProposalModel,
  SupplierProposalResult,
} from "@procurement/application/ports";
import type { CurrencyCode } from "@procurement/domain";

type LegacyModel = Readonly<{
  propose(supplierId: string, context: unknown): Promise<unknown>;
}>;

type LegacyMetadata = Readonly<Record<string, unknown>>;

const asCurrency = (value: string): CurrencyCode => {
  if (value === "USD" || value === "EUR" || value === "BRL") return value;
  throw new Error(`unsupported negotiation currency: ${value}`);
};

const metadataOf = (value: unknown): LegacyMetadata =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as LegacyMetadata)
    : {};

const jsonValue = (value: unknown): JsonValue | undefined => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const values = value.map(jsonValue);
    return values.some((item) => item === undefined)
      ? undefined
      : (values as JsonValue[]);
  }
  const object = metadataOf(value);
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const entries = Object.entries(object).map(
    ([key, item]) => [key, jsonValue(item)] as const,
  );
  return entries.some(([, item]) => item === undefined)
    ? undefined
    : (Object.fromEntries(entries) as JsonValue);
};

const jsonRecord = (value: unknown): JsonValue => jsonValue(value) ?? {};

const resultOf = (value: unknown): SupplierProposalResult => {
  const modelResult = metadataOf(value);
  const metadata = jsonRecord(modelResult.metadata);
  const status = modelResult.status;
  if (status === "proposal")
    return {
      status,
      result: { status, proposal: jsonRecord(modelResult.proposal), metadata },
      metadata,
    };
  if (
    status === "refused" ||
    status === "invalid" ||
    status === "timeout" ||
    status === "provider_error"
  )
    return {
      status,
      result: {
        status,
        reason:
          typeof modelResult.reason === "string"
            ? modelResult.reason
            : "provider returned no reason",
        metadata,
      },
      metadata,
    };
  return {
    status: "invalid",
    result: {
      status: "invalid",
      reason: "provider returned an invalid result shape",
      metadata,
    },
    metadata,
  };
};

const legacyContext = (context: SupplierProposalContext) => ({
  brandId: context.brandId,
  quotationId: context.quotationId,
  round: context.round,
  currency: asCurrency(context.currency),
  lines: context.lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity.toString(),
    baselineUnitPriceMinor: line.baselineUnitPriceMinor.toString(),
  })),
  brandMessage: context.brandMessage,
  priorConversation: context.priorConversation,
  ...(context.untrustedData === undefined
    ? {}
    : { untrustedData: context.untrustedData }),
});

/** Bridges existing agent models to application-owned ports without exposing SDK types. */
export class OpenAIProposalModelAdapter implements SupplierProposalModel {
  constructor(private readonly model: LegacyModel) {}

  async propose(
    context: SupplierProposalContext,
  ): Promise<SupplierProposalResult> {
    return resultOf(
      await this.model.propose(context.supplierId, legacyContext(context)),
    );
  }
}
