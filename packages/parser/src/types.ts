export type RawValue = string | number | boolean | null;
export interface CellEvidence {
  sheet: string;
  address: string;
  displayed: string | null;
  raw: RawValue;
  formula?: string;
  numberFormat?: string;
  mergedFrom?: string;
}
export interface Field<T> {
  value: T;
  evidence: CellEvidence[];
  confidence: number;
}
export interface Warning {
  code: string;
  message: string;
  evidence?: CellEvidence[];
}
export interface SourceRegion {
  sheet: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}
export interface PriceTier {
  minimumQuantity?: number;
  unitPrice: Field<string>;
}
export interface ParsedLine {
  evidence: CellEvidence[];
  sku?: Field<string>;
  description?: Field<string>;
  quantityCandidates: Field<string>[];
  unitPriceCandidates: Field<string>[];
  lineTotal?: Field<string>;
  tiers: PriceTier[];
  fieldRoleStatus: "resolved" | "ambiguous";
  confidence: number;
  warnings: Warning[];
}
export interface QuoteScenario {
  id: string;
  sourceRegions: SourceRegion[];
  label?: string;
  metadata: Record<string, Field<string>>;
  lines: ParsedLine[];
  groupingReasons: Warning[];
  confidence: number;
}
export interface ParsedQuote {
  parserVersion: string;
  scenarios: QuoteScenario[];
  warnings: Warning[];
  sheets: SheetInventory[];
}
export interface SheetInventory {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  usedRange?: string;
  mergedRegions: string[];
  tables: string[];
  relationships: string[];
}
export interface ParserLimits {
  maxBytes: number;
  maxExpandedBytes: number;
  maxSheets: number;
  maxRows: number;
  maxColumns: number;
  maxCells: number;
}
