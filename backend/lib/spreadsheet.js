import ExcelJS from "exceljs";

// Normalizes a header cell into a lowercase, alphanumeric-only key so
// "Plate Number", "plate_number", and "plateNumber" all resolve the same way.
function normalizeKey(key) {
  return String(key ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellText(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim(); // rich text
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim(); // formula
  return String(value).trim();
}

// Parses an uploaded .xlsx or .csv file buffer into an array of plain
// objects, one per data row, keyed by normalized header names. Throws if the
// file can't be parsed at all (corrupt/unsupported).
export async function parseSpreadsheetRows(buffer, originalname = "") {
  const workbook = new ExcelJS.Workbook();
  const isCsv = originalname.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const { Readable } = await import("stream");
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeKey(cellText(cell));
  });

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const obj = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const text = cellText(cell);
      if (text) hasValue = true;
      obj[key] = text;
    });

    if (hasValue) rows.push(obj);
  }

  return rows;
}
