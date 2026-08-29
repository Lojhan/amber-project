export const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === "";

export const toScalar = (value: unknown): string | number | boolean | null =>
  typeof value === "object" && value !== null && "result" in value
    ? toScalar((value as { result?: unknown }).result)
    : value === null || value === undefined
      ? null
      : typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ? value
        : String(value);

export const isFooter = (row: unknown[]): boolean =>
  row.some((value) =>
    /^(total|grand total|subtotal|合计|总价)$/i.test(
      String(value ?? "").trim(),
    ),
  );

export function findPriceColumns(row: unknown[]): number[] {
  return row
    .map((value, index) =>
      /(?:price|fob|prix|单价)/i.test(String(value ?? "")) ? index : -1,
    )
    .filter((index) => index >= 0);
}

export function findQuoteRuns(
  values: unknown[][],
  headerRow: number,
  skuColumn: number,
): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | undefined;
  let blanks = 0;
  const seen = new Set<string>();
  for (let index = headerRow + 1; index < values.length; index += 1) {
    const transition = processQuoteRow(
      values[index]!,
      toScalar(values[index]![skuColumn]),
      index,
      start,
      blanks,
      seen,
    );
    if (transition.footer) {
      if (start !== undefined) runs.push({ start, end: index - 1 });
      start = transition.start;
      break;
    }
    if (transition.run) runs.push(transition.run);
    start = transition.start;
    blanks = transition.blanks;
  }
  if (start !== undefined) runs.push({ start, end: values.length - 1 });
  return runs;
}

function processQuoteRow(
  row: unknown[],
  sku: unknown,
  index: number,
  start: number | undefined,
  blanks: number,
  seen: Set<string>,
): {
  footer: boolean;
  run?: { start: number; end: number };
  start: number | undefined;
  blanks: number;
} {
  if (isFooter(row)) return { footer: true, start: undefined, blanks };
  if (isBlank(sku)) {
    const next = blanks + 1;
    return start !== undefined && next >= 2
      ? {
          footer: false,
          run: { start, end: index - next },
          start: undefined,
          blanks: next,
        }
      : { footer: false, start, blanks: next };
  }
  if (start !== undefined && seen.has(String(sku))) {
    seen.clear();
    seen.add(String(sku));
    return {
      footer: false,
      run: { start, end: index - 1 },
      start: index,
      blanks: 0,
    };
  }
  seen.add(String(sku));
  return { footer: false, start: start ?? index, blanks: 0 };
}
