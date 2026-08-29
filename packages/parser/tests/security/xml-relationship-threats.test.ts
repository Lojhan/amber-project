import { describe, expect, it } from "vitest";
import {
  assertSafeXml,
  relationshipTargets,
} from "../../src/ooxml-relationships.js";
import { preflightOOXML } from "../../src/preflight.js";
import { buildWorkbook, validParts } from "../helpers/ooxml-builder.js";

describe("OOXML relationship graph", () => {
  it("rejects an external relationship target", async () => {
    const relationships = validParts.relationships.replace(
      'Target="worksheets/sheet1.xml"',
      'Target="https://attacker.invalid/file" TargetMode="External"',
    );
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "external_relationship",
    });
  });

  it("rejects relationship traversal", async () => {
    const relationships = validParts.relationships.replace(
      "worksheets/sheet1.xml",
      "../outside.xml",
    );
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsafe_relationship_target",
    });
  });

  it("rejects an absolute relationship target", () => {
    expect(() =>
      relationshipTargets('<Relationship Target="/outside.xml"/>'),
    ).toThrow("unsafe_relationship_target");
  });

  it("rejects a relationship with a missing worksheet part", async () => {
    const relationships = validParts.relationships.replace(
      "sheet1.xml",
      "missing.xml",
    );
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing_sheet_target",
    });
  });

  it("rejects a graph without worksheet relationships", async () => {
    const relationships = validParts.relationships.replace(
      /<Relationship\b[\s\S]*?\/>/,
      "",
    );
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "sheet_limit",
    });
  });

  it("rejects malformed relationship XML", async () => {
    const relationships =
      '<Relationships><Relationship Target="worksheets/sheet1.xml">';
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid_xml",
    });
  });
});

describe("XML declaration boundary", () => {
  it("rejects a DTD before relationship matching", async () => {
    const relationships = `<!DOCTYPE Relationships SYSTEM "https://attacker.invalid/x">
${validParts.relationships}`;
    await expect(
      preflightOOXML(buildWorkbook({ relationships })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "xml_dtd_forbidden",
    });
  });

  it("rejects an entity declaration in a worksheet", async () => {
    const worksheet = `<!DOCTYPE worksheet [<!ENTITY secret SYSTEM "file:///etc/passwd">]>
${validParts.worksheet}`;
    await expect(
      preflightOOXML(buildWorkbook({ worksheet })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "xml_dtd_forbidden",
    });
  });

  it("rejects a truncated worksheet element", async () => {
    const worksheet = '<worksheet><sheetData><row r="1">';
    await expect(
      preflightOOXML(buildWorkbook({ worksheet })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid_xml",
    });
  });

  it("rejects an oversized XML part", async () => {
    const contentTypes = validParts.contentTypes.replace(
      "</Types>",
      `<!--${noisyText(2_100_000)}--></Types>`,
    );
    await expect(
      preflightOOXML(buildWorkbook({ contentTypes })),
    ).resolves.toMatchObject({
      ok: false,
      reason: "xml_size_limit",
    });
  }, 10_000);

  it("allows formula and cached-value elements through preflight", async () => {
    const worksheet = validParts.worksheet.replace(
      "</row>",
      '<c r="B1"><f>1+1</f><v>2</v></c></row>',
    );
    await expect(
      preflightOOXML(buildWorkbook({ worksheet })),
    ).resolves.toMatchObject({
      ok: true,
    });
  });

  it("validates balanced element names", () => {
    expect(() => assertSafeXml("<a><b/></a>")).not.toThrow();
    expect(() => assertSafeXml("<a><b></a></b>")).toThrow("invalid_xml");
  });
});

function noisyText(size: number): string {
  let state = 0x1a2b3c4d;
  const chunks: string[] = [];
  for (let index = 0; index < size; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    chunks.push(String.fromCharCode(33 + (state % 90)));
  }
  return chunks.join("");
}
