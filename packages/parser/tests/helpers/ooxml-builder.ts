import { buildZip, type ZipSource } from "./zip-builder.js";

export interface WorkbookParts {
  contentTypes?: string;
  workbook?: string;
  relationships?: string;
  worksheet?: string;
  extras?: readonly ZipSource[];
}

const contentTypes = `<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const workbook = `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets><sheet name="Quote" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const relationships = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const worksheet = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>SKU</t></is></c></row></sheetData>
</worksheet>`;

export function buildWorkbook(parts: WorkbookParts = {}): Uint8Array {
  return buildZip([
    {
      name: "[Content_Types].xml",
      content: parts.contentTypes ?? contentTypes,
    },
    { name: "xl/workbook.xml", content: parts.workbook ?? workbook },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: parts.relationships ?? relationships,
    },
    { name: "xl/worksheets/sheet1.xml", content: parts.worksheet ?? worksheet },
    ...(parts.extras ?? []),
  ]);
}

export const validParts = { contentTypes, workbook, relationships, worksheet };
