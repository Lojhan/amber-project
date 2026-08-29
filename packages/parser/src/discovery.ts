import { normalizeText } from "./normalize.js";
export const HEADER_ALIASES = {
  sku: ["sku", "style", "item", "product code", "article", "style/sku id"],
  description: ["description", "product", "name", "item name", "产品"],
  quantity: [
    "qty",
    "quantity",
    "units",
    "pieces",
    "quantité",
    "quantity (pcs)",
    "数量",
  ],
  unitPrice: [
    "unit price",
    "price",
    "fob",
    "unit cost",
    "prix unitaire",
    "单价",
  ],
  total: ["total", "amount", "line total", "montant", "总价"],
} as const;
export type HeaderRole = keyof typeof HEADER_ALIASES;
export interface HeaderDiscovery {
  row: number;
  columns: Partial<Record<HeaderRole, number>>;
  score: number;
  warnings: string[];
}
export function discoverHeader(rows: unknown[][]): HeaderDiscovery | null {
  let best: HeaderDiscovery | null = null;
  rows.slice(0, 50).forEach((row, rowIndex) => {
    const columns: Partial<Record<HeaderRole, number>> = {};
    let score = 0;

    row.forEach((value, i) => {
      const text = normalizeText(String(value ?? ""));
      (Object.keys(HEADER_ALIASES) as HeaderRole[]).forEach((role) => {
        const priceBandIsNotRequestedQuantity =
          role === "quantity" && /(?:price|fob|prix|单价)/i.test(text);
        if (
          !priceBandIsNotRequestedQuantity &&
          HEADER_ALIASES[role].some(
            (alias) => text === alias || text.includes(alias),
          ) &&
          !columns[role]
        ) {
          columns[role] = i;
          score += role === "sku" ? 3 : 1;
        }
      });
    });
    if (score && (best === null || score > best.score))
      best = {
        row: rowIndex,
        columns,
        score,
        warnings: score < 3 ? ["weak_header_match"] : [],
      };
  });
  return best;
}
export interface WorkbookReader {
  inventory(bytes: Uint8Array): Promise<import("./types.js").SheetInventory[]>;
  extract(
    bytes: Uint8Array,
    sheet: string,
    region: import("./types.js").SourceRegion,
  ): Promise<unknown[][]>;
}
