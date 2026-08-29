import ExcelJS from "exceljs";

export type WorkbookLoader = (bytes: Uint8Array) => Promise<ExcelJS.Workbook>;

export async function loadExcelWorkbook(
  bytes: Uint8Array,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);

  return workbook;
}
