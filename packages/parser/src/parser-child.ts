import { parseWorkbook } from "./workbook.js";

const maxBytes = 25 * 1024 * 1024;

export async function parseChild(
  input: AsyncIterable<Uint8Array>,
  parse: typeof parseWorkbook = parseWorkbook,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of input) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error("input exceeds parser limit");
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.stringify({ version: 1, result: await parse(bytes) });
}

if (process.argv[1]?.endsWith("/parser-child.ts")) {
  try {
    process.stdout.write(await parseChild(process.stdin));
  } catch {
    process.stderr.write("parser failed\n");
    process.exitCode = 1;
  }
}
