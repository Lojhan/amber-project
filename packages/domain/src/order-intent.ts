import { DomainInvariantError } from "./errors.js";
import type { BrandId, ProductId, QuotationId } from "./ids.js";
import {
  addMoney,
  type CurrencyCode,
  type Money,
  money,
  multiplyMoney,
} from "./money.js";
export type OrderIntentLine = Readonly<{
  productId: ProductId;
  quantity: bigint;
  baselineUnitPrice: Money;
}>;
export type OrderIntent = Readonly<{
  quotationId: QuotationId;
  brandId: BrandId;
  currency: CurrencyCode;
  lines: readonly OrderIntentLine[];
}>;
export const validateOrderIntent = (intent: OrderIntent): void => {
  if (intent.lines.length === 0)
    throw new DomainInvariantError(
      "order-lines",
      "Order requires at least one line",
    );
  const products = new Set<string>();
  for (const line of intent.lines) {
    if (line.quantity <= 0n)
      throw new DomainInvariantError(
        "quantity-positive",
        "Every line quantity must be positive",
      );
    if (
      line.baselineUnitPrice.currency !== intent.currency ||
      line.baselineUnitPrice.minor <= 0n
    )
      throw new DomainInvariantError(
        "baseline-price",
        "Baseline prices must be positive and currency-consistent",
      );
    if (products.has(line.productId))
      throw new DomainInvariantError(
        "order-product-unique",
        "Product may occur only once",
      );
    products.add(line.productId);
  }
};

export const baselineTotal = (intent: OrderIntent): Money => {
  validateOrderIntent(intent);
  return intent.lines.reduce(
    (total, line) =>
      addMoney(total, multiplyMoney(line.baselineUnitPrice, line.quantity)),
    money(intent.currency, 0n),
  );
};
