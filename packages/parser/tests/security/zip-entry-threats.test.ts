import { describe, expect, it } from "vitest";
import { preflightOOXML } from "../../src/preflight.js";
import {
  canonicalEntryName,
  isSafeZipEntryName,
} from "../../src/zip-preflight.js";
import { buildWorkbook, validParts } from "../helpers/ooxml-builder.js";
import { buildZip, type ZipSource } from "../helpers/zip-builder.js";

const rejectExtra = async (extra: ZipSource) =>
  preflightOOXML(buildWorkbook({ extras: [extra] }));

describe("ZIP entry boundary", () => {
  it("accepts a small valid OOXML package", async () => {
    await expect(preflightOOXML(buildWorkbook())).resolves.toMatchObject({
      ok: true,
      expandedBytes: expect.any(Number),
    });
  });

  it("rejects an absolute POSIX entry", async () => {
    await expect(
      rejectExtra({ name: "/tmp/payload", content: "x" }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsafe_entry",
    });
  });

  it("rejects an absolute Windows entry", async () => {
    await expect(
      rejectExtra({ name: "C:\\temp\\payload", content: "x" }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsafe_entry",
    });
  });

  it("rejects a traversal entry", async () => {
    const result = await rejectExtra({ name: "xl/../payload", content: "x" });
    expect(result.ok).toBe(false);
    expect(["unsafe_entry", "invalid_zip"]).toContain(result.reason);
  });

  it("rejects case-folded duplicate names", async () => {
    await expect(
      preflightOOXML(
        buildWorkbook({
          extras: [{ name: "XL/WORKBOOK.XML", content: validParts.workbook }],
        }),
      ),
    ).resolves.toMatchObject({ ok: false, reason: "unsafe_entry" });
  });

  it("rejects encrypted entries", async () => {
    await expect(
      rejectExtra({ name: "payload.bin", content: "x", flags: 0x0801 }),
    ).resolves.toMatchObject({ ok: false, reason: "encrypted_or_descriptor" });
  });

  it("rejects data-descriptor entries", async () => {
    await expect(
      rejectExtra({ name: "payload.bin", content: "x", flags: 0x0808 }),
    ).resolves.toMatchObject({ ok: false, reason: "encrypted_or_descriptor" });
  });

  it("rejects unsupported compression", async () => {
    await expect(
      rejectExtra({ name: "payload.bin", content: "x", compression: 99 }),
    ).resolves.toMatchObject({ ok: false, reason: "unsupported_compression" });
  });

  it("rejects expansion-ratio metadata", async () => {
    await expect(
      rejectExtra({
        name: "payload.bin",
        content: "x",
        declaredCompressedSize: 1,
        declaredExpandedSize: 2_000,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "ratio_limit" });
  });

  it("rejects aggregate expanded bytes", async () => {
    await expect(
      preflightOOXML(buildWorkbook(), { maxExpandedBytes: 10 }),
    ).resolves.toMatchObject({ ok: false, reason: "expansion_limit" });
  });

  it("rejects macro parts", async () => {
    await expect(
      rejectExtra({ name: "xl/vbaProject.bin", content: "macro" }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsupported_workbook_part",
    });
  });

  it("rejects external-link parts", async () => {
    await expect(
      rejectExtra({ name: "xl/externalLinks/externalLink1.xml", content: "x" }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsupported_workbook_part",
    });
  });

  it("rejects a truncated central directory", async () => {
    const bytes = buildWorkbook();
    await expect(
      preflightOOXML(bytes.slice(0, bytes.byteLength - 8)),
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid_zip",
    });
  });

  it("rejects malformed ZIP metadata", async () => {
    const bytes = buildZip([{ name: "x", content: "x" }]);
    const central = findSignature(bytes, [0x50, 0x4b, 0x01, 0x02]);
    bytes[central] = 0;
    await expect(preflightOOXML(bytes)).resolves.toMatchObject({
      ok: false,
      reason: "invalid_zip",
    });
  });
});

describe("ZIP name policy", () => {
  it("normalizes Unicode and case for duplicate detection", () => {
    expect(canonicalEntryName("XL/WORKBOOK.XML")).toBe("xl/workbook.xml");
  });

  it("permits safe package-relative names", () => {
    expect(isSafeZipEntryName("xl/worksheets/sheet1.xml")).toBe(true);
  });

  it.each(["../x", "a/../x", "a//x", "C:/x", "\\\\host\\x", "a\\x", "\u0000x"])(
    "rejects unsafe name %j",
    (name) => {
      expect(isSafeZipEntryName(name)).toBe(false);
    },
  );
});

function findSignature(
  bytes: Uint8Array,
  signature: readonly number[],
): number {
  for (
    let index = 0;
    index <= bytes.byteLength - signature.length;
    index += 1
  ) {
    if (signature.every((byte, offset) => bytes[index + offset] === byte))
      return index;
  }
  throw new Error("test ZIP signature missing");
}
