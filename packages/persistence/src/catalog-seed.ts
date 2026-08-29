import { createHash } from "node:crypto";

export type CatalogBrand = "valden" | "solenne";
export type CatalogSeedRow = {
  brand: CatalogBrand;
  sku: string;
  name: string | null;
  color: string | null;
};
export type CatalogSeedPlan = {
  catalogVersion: string;
  rows: Array<CatalogSeedRow & { id: string; brandId: string }>;
  counts: Record<CatalogBrand, number>;
};
export const brandSeedIds: Record<CatalogBrand, string> = {
  valden: "99999999-0000-4000-8000-000000000001",
  solenne: "99999999-0000-4000-8000-000000000002",
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: RFC4180 is a character state machine.
export function parseCatalogCsv(csv: string): CatalogSeedRow[] {
  const records: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("unterminated quoted catalog field");
  if (cell !== "" || row.length > 0) records.push([...row, cell]);
  const header = records.shift();
  if (header?.join(",") !== "brand,sku,name,color")
    throw new Error("unexpected catalog header");
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record, index) => {
      const [brand, sku, name, color] = record;
      if (
        record.length !== 4 ||
        !sku ||
        (brand !== "valden" && brand !== "solenne")
      )
        throw new Error(`invalid catalog row ${index + 2}`);
      return { brand, sku, name: name || null, color: color || null };
    });
}

export function catalogVersion(csv: string): string {
  return createHash("sha256").update(csv).digest("hex").slice(0, 16);
}

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildCatalogSeedPlan(csv: string): CatalogSeedPlan {
  const version = catalogVersion(csv);
  const counts: Record<CatalogBrand, number> = { valden: 0, solenne: 0 };
  const rows = parseCatalogCsv(csv).map((row) => {
    counts[row.brand] += 1;

    return {
      ...row,
      id: deterministicUuid(`${row.brand}:${version}:${row.sku}`),
      brandId: brandSeedIds[row.brand],
    };
  });

  if (counts.valden === 0 || counts.solenne === 0)
    throw new Error("catalog must contain both brands");
  return { catalogVersion: version, rows, counts };
}
