export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };
export type BrandId = Brand<string, "BrandId">;
export type ProductId = Brand<string, "ProductId">;
export type QuotationId = Brand<string, "QuotationId">;
export type NegotiationId = Brand<string, "NegotiationId">;
export type OfferId = Brand<string, "OfferId">;
export type RecommendationId = Brand<string, "RecommendationId">;
export type PurchaseOrderId = Brand<string, "PurchaseOrderId">;
export type ActorId = Brand<string, "ActorId">;
export type DomainEventId = Brand<string, "DomainEventId">;
export const asBrandId = (value: string): BrandId => value as BrandId;

export const asProductId = (value: string): ProductId => value as ProductId;

export const asQuotationId = (value: string): QuotationId =>
  value as QuotationId;

export const asNegotiationId = (value: string): NegotiationId =>
  value as NegotiationId;

export const asOfferId = (value: string): OfferId => value as OfferId;

export const asRecommendationId = (value: string): RecommendationId =>
  value as RecommendationId;

export const asPurchaseOrderId = (value: string): PurchaseOrderId =>
  value as PurchaseOrderId;

export const asActorId = (value: string): ActorId => value as ActorId;
