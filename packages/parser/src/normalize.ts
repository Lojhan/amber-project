export function normalizeSku(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[\s_]+/g, "-");
}

export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export function osaDistance(a: string, b: string, max = 3): number {
  a = normalizeSku(a);
  b = normalizeSku(b);

  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i),
    prev2: number[] = [];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(
        row[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, (prev2[j - 2] ?? 0) + 1);
      row.push(v);
    }
    if (Math.min(...row) > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] ?? max + 1;
}
