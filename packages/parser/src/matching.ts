import { normalizeSku, normalizeText, osaDistance } from "./normalize.js";
export interface CatalogProduct {
  id?: string;
  brand: string;
  sku: string;
  name?: string;
  color?: string;
  [key: string]: unknown;
}
export interface MatchCandidate {
  product: CatalogProduct;
  score: number;
  distance: number;
  components: { sku: number; semantic: number };
  reasons: string[];
}
export interface MatchResult {
  status: "matched" | "needs_review" | "not_found";
  candidates: MatchCandidate[];
  selected?: CatalogProduct;
  confidence: number;
  margin: number;
}
export function matchSku(
  rawSku: string,
  catalog: CatalogProduct[],
  brand = "valden",
  corroboration?: { description?: string; color?: string; size?: string },
): MatchResult {
  const scoped = catalog.filter(
    (p) => p.brand.toLowerCase() === brand.toLowerCase(),
  );
  const key = normalizeSku(rawSku);
  const keys = new Set([key, ...ocrVariants(key)]);
  const scored = scoped
    .map((p) => scoreCandidate(p, key, keys, corroboration))
    .filter((x): x is MatchCandidate => x !== null)
    .sort(
      (a, b) => b.score - a.score || a.product.sku.localeCompare(b.product.sku),
    )
    .slice(0, 5);
  const confidence = scored[0]?.score ?? 0,
    margin = confidence - (scored[1]?.score ?? 0);
  const selected =
    confidence === 1 || (confidence >= 0.92 && margin >= 0.08)
      ? scored[0]?.product
      : undefined;

  return {
    status: selected ? "matched" : scored.length ? "needs_review" : "not_found",
    candidates: scored,
    ...(selected ? { selected } : {}),
    confidence,
    margin,
  };
}

function scoreCandidate(
  product: CatalogProduct,
  key: string,
  keys: Set<string>,
  corroboration?: { description?: string; color?: string; size?: string },
): MatchCandidate | null {
  const canonical = normalizeSku(product.sku);
  const exact = canonical === key;
  const distance = exact
    ? 0
    : Math.min(...[...keys].map((k) => osaDistance(k, canonical, 2)));
  const sku = skuScore(exact, distance);
  if (!sku) return null;
  const semantic = semanticScore(product, corroboration);
  return {
    product,
    score: exact ? 1 : sku * 0.9 + semantic * 0.1,
    distance,
    components: { sku, semantic },
    reasons: exact
      ? ["exact_canonical_sku"]
      : ["bounded_osa_candidate", "ocr_variant_checked"],
  };
}

function skuScore(exact: boolean, distance: number): number {
  if (exact) return 1;
  if (distance === 1) return 0.94;
  if (distance === 2) return 0.84;
  return 0;
}

function semanticScore(
  product: CatalogProduct,
  corroboration?: { description?: string; color?: string; size?: string },
): number {
  return corroboration?.description &&
    product.name &&
    normalizeText(corroboration.description).includes(
      normalizeText(product.name),
    )
    ? 1
    : 0;
}

function ocrVariants(s: string): string[] {
  const out = new Set<string>();
  for (const [a, b] of [
    ["0", "O"],
    ["O", "0"],
    ["1", "I"],
    ["I", "1"],
  ] as const)
    for (const i of s.split("").keys())
      if (s[i] === a) out.add(s.slice(0, i) + b + s.slice(i + 1));
  return [...out];
}
