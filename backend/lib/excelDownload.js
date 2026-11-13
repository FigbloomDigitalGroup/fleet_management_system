import ExcelJS from "exceljs";

// Sends one sheet as an Excel download: the reports' detail sheets
// (controllers/reportDetailsController.js) and the expenses export.
// sheetDef = { title, columns: [[header, key, width?]], rows, total? }
export async function sendSheetDownload(res, sheetDef, filename) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FIGBLOOM FLEET";
  const sheet = workbook.addWorksheet(sheetDef.title);
  sheet.columns = sheetDef.columns.map(([header, key, width]) => ({ header, key, width: width ?? 16 }));
  sheet.getRow(1).font = { bold: true };
  sheetDef.rows.forEach((r) => sheet.addRow(r));
  if (sheetDef.total) sheet.addRow(sheetDef.total).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}
