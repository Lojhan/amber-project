import { deflateRawSync } from "node:zlib";

export interface ZipSource {
  name: string;
  content?: string | Uint8Array;
  compression?: 0 | 8 | number;
  flags?: number;
  declaredCompressedSize?: number;
  declaredExpandedSize?: number;
}

interface EncodedSource {
  name: Buffer;
  body: Buffer;
  crc: number;
  compression: number;
  flags: number;
  compressedSize: number;
  expandedSize: number;
  offset: number;
}

export function buildZip(sources: readonly ZipSource[]): Uint8Array {
  const localParts: Buffer[] = [];
  const encoded: EncodedSource[] = [];
  let offset = 0;

  for (const source of sources) {
    const raw = toBuffer(source.content ?? "");
    const compression = source.compression ?? 8;
    const body = compression === 8 ? deflateRawSync(raw) : raw;
    const entry = encodeSource(source, raw, body, offset);
    const local = localHeader(entry);

    localParts.push(local, body);
    encoded.push(entry);
    offset += local.byteLength + body.byteLength;
  }

  const central = encoded.map(centralHeader);
  const centralSize = central.reduce(
    (total, part) => total + part.byteLength,
    0,
  );
  const end = endRecord(encoded.length, centralSize, offset);

  return Buffer.concat([...localParts, ...central, end]);
}

function encodeSource(
  source: ZipSource,
  raw: Buffer,
  body: Buffer,
  offset: number,
): EncodedSource {
  return {
    name: Buffer.from(source.name, "utf8"),
    body,
    crc: crc32(raw),
    compression: source.compression ?? 8,
    flags: source.flags ?? 0x0800,
    compressedSize: source.declaredCompressedSize ?? body.byteLength,
    expandedSize: source.declaredExpandedSize ?? raw.byteLength,
    offset,
  };
}

function localHeader(entry: EncodedSource): Buffer {
  const header = Buffer.alloc(30 + entry.name.byteLength);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.flags, 6);
  header.writeUInt16LE(entry.compression, 8);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressedSize, 18);
  header.writeUInt32LE(entry.expandedSize, 22);
  header.writeUInt16LE(entry.name.byteLength, 26);
  entry.name.copy(header, 30);

  return header;
}

function centralHeader(entry: EncodedSource): Buffer {
  const header = Buffer.alloc(46 + entry.name.byteLength);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(entry.flags, 8);
  header.writeUInt16LE(entry.compression, 10);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.expandedSize, 24);
  header.writeUInt16LE(entry.name.byteLength, 28);
  header.writeUInt32LE(entry.offset, 42);
  entry.name.copy(header, 46);

  return header;
}

function endRecord(
  entries: number,
  centralSize: number,
  offset: number,
): Buffer {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries, 8);
  end.writeUInt16LE(entries, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return end;
}

function toBuffer(value: string | Uint8Array): Buffer {
  return typeof value === "string"
    ? Buffer.from(value, "utf8")
    : Buffer.from(value);
}

function crc32(value: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
