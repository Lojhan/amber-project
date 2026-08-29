import type { ParserLimits } from "./types.js";
import {
  findZipEntry,
  readZipText,
  type ZipInventory,
} from "./zip-preflight.js";

const XML_CAP = 2 * 1024 * 1024;
export interface OoxmlGraph {
  readonly worksheetParts: readonly string[];
}

export function assertSafeXml(xml: string): void {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new Error("xml_dtd_forbidden");
  }

  assertWellFormedTags(xml);
}

function assertWellFormedTags(xml: string): void {
  const tokens = xml.match(
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g,
  );
  if (!tokens?.length) throw new Error("invalid_xml");

  const remainder = tokens.reduce(
    (text, token) => text.replace(token, ""),
    xml,
  );
  if (/[<>]/.test(remainder)) throw new Error("invalid_xml");

  const stack: string[] = [];
  for (const token of tokens) {
    if (/^<\?|^<!--|^<!\[CDATA\[/.test(token)) continue;
    const closing = /^<\/\s*([^\s>]+)\s*>$/.exec(token);
    if (closing) {
      if (stack.pop() !== closing[1]) throw new Error("invalid_xml");
      continue;
    }
    const opening = /^<\s*([^\s/>]+)/.exec(token)?.[1];
    if (!opening) throw new Error("invalid_xml");
    if (!/\/\s*>$/.test(token)) stack.push(opening);
  }
  if (stack.length > 0) throw new Error("invalid_xml");
}

/** Checks package type and internal workbook-to-sheet relationship targets. */
export async function validateOoxmlGraph(
  inventory: ZipInventory,
  limits: ParserLimits,
): Promise<OoxmlGraph> {
  const text = (name: string) =>
    readZipText(
      inventory.zip,
      findZipEntry(inventory, name),
      Math.min(XML_CAP, limits.maxExpandedBytes),
    );
  const [contentTypes, workbook, relationships] = await Promise.all([
    text("[content_types].xml"),
    text("xl/workbook.xml"),
    text("xl/_rels/workbook.xml.rels"),
  ]);

  assertSafeXml(contentTypes);
  assertSafeXml(workbook);
  assertSafeXml(relationships);

  if (!/spreadsheetml\.sheet\.main\+xml/i.test(contentTypes))
    throw new Error("invalid_content_types");
  if (!/<workbook[\s>]/i.test(workbook)) throw new Error("invalid_workbook");
  if (/TargetMode=["']External["']/i.test(relationships))
    throw new Error("external_relationship");
  const worksheetParts = relationshipTargets(relationships)
    .filter((target) => /^worksheets\/[^/]+\.xml$/i.test(target))
    .map((target) => `xl/${target.toLowerCase()}`);
  if (!worksheetParts.length || worksheetParts.length > limits.maxSheets)
    throw new Error("sheet_limit");
  if (worksheetParts.some((part) => !findZipEntry(inventory, part)))
    throw new Error("missing_sheet_target");
  return { worksheetParts };
}

export function relationshipTargets(xml: string): string[] {
  const targets: string[] = [];
  for (const match of xml.matchAll(/<Relationship\b([^>]+)>/gi)) {
    const target = /\bTarget=["']([^"']+)["']/i.exec(match[1] ?? "")?.[1];
    if (!target) continue;
    if (
      target.startsWith("/") ||
      target.includes("..") ||
      target.includes("\\")
    )
      throw new Error("unsafe_relationship_target");
    targets.push(target.replace(/^\.\//, ""));
  }
  return targets;
}
