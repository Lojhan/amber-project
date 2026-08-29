import yauzl from "yauzl";
import type { ParserLimits } from "./types.js";

export interface ZipEntry {
  readonly name: string;
  readonly entry: yauzl.Entry;
}

export interface ZipInventory {
  readonly zip: yauzl.ZipFile;
  readonly entries: readonly ZipEntry[];
  readonly expandedBytes: number;
  readonly close: () => void;
}

const MAX_ENTRIES = 10_000;

export async function inspectZip(
  bytes: Uint8Array,
  limits: ParserLimits,
): Promise<ZipInventory> {
  if (bytes.byteLength > limits.maxBytes) throw new Error("file_size_limit");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("not_zip");
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) return reject(new Error("invalid_zip"));
        const entries: ZipEntry[] = [];
        const names = new Set<string>();
        let expandedBytes = 0;
        let compressedBytes = 0;
        let settled = false;
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          zip.close();
        };
        const fail = (reason: string) => {
          if (settled) return;
          settled = true;
          close();
          reject(new Error(reason));
        };

        zip.on("error", (zipError) => fail(classifyZipError(zipError)));
        zip.on("entry", (entry: yauzl.Entry) => {
          const name = entry.fileName;
          const key = canonicalEntryName(name);
          const rejection = entryRejection(entry, names, {
            entryCount: entries.length + 1,
            expandedBytes: expandedBytes + entry.uncompressedSize,
            compressedBytes: compressedBytes + entry.compressedSize,
            limits,
          });

          if (rejection) return fail(rejection);

          names.add(key);
          entries.push({ name: key, entry });
          expandedBytes += entry.uncompressedSize;
          compressedBytes += entry.compressedSize;
          zip.readEntry();
        });
        zip.on("end", () => {
          if (!settled) {
            settled = true;
            resolve({ zip, entries, expandedBytes, close });
          }
        });
        zip.readEntry();
      },
    );
  });
}

export function findZipEntry(
  inventory: ZipInventory,
  name: string,
): yauzl.Entry | undefined {
  return inventory.entries.find((item) => item.name === name.toLowerCase())
    ?.entry;
}

export async function readZipText(
  zip: yauzl.ZipFile,
  entry: yauzl.Entry | undefined,
  cap: number,
): Promise<string> {
  if (!entry) throw new Error("missing_required_part");
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(new Error("xml_read_error"));
      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(reason));
      };

      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;

        if (size > cap) {
          fail("xml_size_limit");
          stream.destroy();
        } else chunks.push(chunk);
      });
      stream.on("error", () => fail("xml_read_error"));
      stream.on("end", () => {
        if (settled) return;
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
  });
}

export function canonicalEntryName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function isSafeZipEntryName(name: string): boolean {
  if (!name || hasControlCharacter(name)) return false;
  if (name.startsWith("/") || name.startsWith("\\")) return false;
  if (/^[a-z]:[\\/]/i.test(name) || name.includes("\\")) return false;

  const segments = name.split("/");
  const contentSegments = name.endsWith("/") ? segments.slice(0, -1) : segments;

  return contentSegments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

interface EntryTotals {
  entryCount: number;
  expandedBytes: number;
  compressedBytes: number;
  limits: ParserLimits;
}

function entryRejection(
  entry: yauzl.Entry,
  names: ReadonlySet<string>,
  totals: EntryTotals,
): string | undefined {
  const name = entry.fileName;
  if (!isSafeZipEntryName(name) || names.has(canonicalEntryName(name)))
    return "unsafe_entry";
  if (entry.isEncrypted() || (entry.generalPurposeBitFlag & 8) !== 0)
    return "encrypted_or_descriptor";
  if (![0, 8].includes(entry.compressionMethod))
    return "unsupported_compression";
  if (isUnsupportedPart(name)) return "unsupported_workbook_part";
  if (exceedsExpansionLimit(totals)) return "expansion_limit";
  if (exceedsRatioLimit(entry)) return "ratio_limit";

  return undefined;
}

function exceedsExpansionLimit(totals: EntryTotals): boolean {
  return (
    totals.entryCount > MAX_ENTRIES ||
    totals.expandedBytes > totals.limits.maxExpandedBytes ||
    totals.compressedBytes > totals.limits.maxBytes
  );
}

function exceedsRatioLimit(entry: yauzl.Entry): boolean {
  return (
    entry.compressedSize > 0 &&
    entry.uncompressedSize / entry.compressedSize > 1000
  );
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function isUnsupportedPart(name: string): boolean {
  return /(?:^|\/)vbaProject\.bin$|(?:^|\/)externalLinks\//i.test(name);
}

function classifyZipError(error: Error): string {
  if (
    /absolute path|invalid relative path|invalid characters in filename/i.test(
      error.message,
    )
  ) {
    return "unsafe_entry";
  }

  return "invalid_zip";
}
