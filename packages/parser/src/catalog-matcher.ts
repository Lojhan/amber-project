import type {
  CatalogMatcher,
  CatalogProduct,
  JsonValue,
} from "@procurement/application/ports";
import { toJsonValue } from "./isolated-workbook-parser.js";
import { matchSku } from "./matching.js";

/** Bridges application catalog records to the deterministic parser SKU matcher. */
export class ParserCatalogMatcher implements CatalogMatcher {
  match(input: Parameters<CatalogMatcher["match"]>[0]): {
    candidates: JsonValue;
    selectedProductId?: string;
  } {
    // CatalogRepository has already scoped these rows to the requested brand.
    // Supplying that same brand to each scorer input prevents cross-brand matches.
    const catalog = input.catalog.map((product) =>
      toScoringProduct(product, input.brandId),
    );
    const result = matchSku(
      input.rawSku,
      catalog,
      input.brandId,
      input.corroboration,
    );
    const candidates: JsonValue = toJsonValue({
      status: result.status,
      candidates: result.candidates.map((candidate) => ({
        product: {
          id: candidate.product.id ?? "",
          sku: candidate.product.sku,
          name: candidate.product.name ?? null,
          color: candidate.product.color ?? null,
        },
        score: candidate.score,
        distance: candidate.distance,
        components: candidate.components,
        reasons: candidate.reasons,
      })),
      confidence: result.confidence,
      margin: result.margin,
    });
    return {
      candidates,
      ...(result.selected === undefined ||
      typeof result.selected.id !== "string"
        ? {}
        : { selectedProductId: result.selected.id }),
    };
  }
}

const toScoringProduct = (
  product: CatalogProduct,
  brand: string,
): {
  id: string;
  brand: string;
  sku: string;
  name?: string;
  color?: string;
} => ({
  id: product.id,
  brand,
  sku: product.sku,
  ...(product.name === null ? {} : { name: product.name }),
  ...(product.color === null ? {} : { color: product.color }),
});
