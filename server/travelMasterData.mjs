import { getSheetValues } from "./sheetsClient.mjs";

const DEFAULT_MASTER_DATA_HEADER_ROW = 1;
const DEFAULT_MASTER_DATA_SHEET_NAMES = [
  "Travelers",
  "Hotel_Properties",
  "Hotel_Brands",
  "Airports",
  "National_Park_States",
  "Cities",
  "Currencies",
  "Airlines",
  "Credit_Cards",
  "National Parks",
  "Traveler_Loyalty_Accounts",
  "States_Provinces",
  "Rental_Car_Companies",
  "Expense_Categories",
  "Hotel_Chains",
  "Loyalty_Programs",
  "Place_Types",
  "Countries"
];

export async function listTravelMasterData() {
  const spreadsheetId = getMasterDataSpreadsheetId();
  const headerRowNumber = getMasterDataHeaderRowNumber();
  const sheetNames = getMasterDataSheetNames();
  const sheets = await Promise.all(
    sheetNames.map((sheetName) => readMasterDataSheet({ spreadsheetId, sheetName, headerRowNumber }))
  );

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    readOnly: true,
    spreadsheetId,
    headerRowNumber,
    sheets
  };
}

async function readMasterDataSheet({ spreadsheetId, sheetName, headerRowNumber }) {
  assertAllowedMasterDataSheetName(sheetName);

  const values = await getSheetValues({ spreadsheetId, sheetName });
  return normalizeMasterDataValues({ sheetName, values, headerRowNumber });
}

function normalizeMasterDataValues({ sheetName, values, headerRowNumber }) {
  const rows = Array.isArray(values) ? values : [];
  const headerRowIndex = Math.max(headerRowNumber - 1, 0);
  const headerRow = rows[headerRowIndex] || [];
  const width = Math.max(headerRow.length, ...rows.map((row) => row.length), 1);
  const headers = makeUniqueHeaders(
    Array.from({ length: width }, (_, index) => cleanHeader(headerRow[index]) || `Column ${index + 1}`)
  );
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell || "").trim()));

  return {
    name: sheetName,
    readOnly: true,
    headerRowNumber,
    headers,
    rows: dataRows.map((row, rowIndex) => {
      const normalizedRow = { id: `${sheetName}-${headerRowIndex + rowIndex + 2}` };

      headers.forEach((header, columnIndex) => {
        normalizedRow[header] = row[columnIndex] || "";
      });

      return normalizedRow;
    }),
    rowCount: dataRows.length
  };
}

function getMasterDataSpreadsheetId() {
  const spreadsheetId = process.env.TRAVEL_MASTER_DATA_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing TRAVEL_MASTER_DATA_SPREADSHEET_ID.");
  return spreadsheetId;
}

function getMasterDataHeaderRowNumber() {
  const headerRowNumber = Number.parseInt(process.env.TRAVEL_MASTER_DATA_HEADER_ROW || DEFAULT_MASTER_DATA_HEADER_ROW, 10);
  return Number.isFinite(headerRowNumber) && headerRowNumber > 0 ? headerRowNumber : DEFAULT_MASTER_DATA_HEADER_ROW;
}

function getMasterDataSheetNames() {
  const configuredNames = process.env.TRAVEL_MASTER_DATA_SHEET_NAMES;
  if (!configuredNames) return DEFAULT_MASTER_DATA_SHEET_NAMES;

  return configuredNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function assertAllowedMasterDataSheetName(sheetName) {
  if (getMasterDataSheetNames().includes(sheetName)) return;

  const error = new Error(`Unknown travel master data sheet: ${sheetName || "missing"}.`);
  error.statusCode = 400;
  throw error;
}

function cleanHeader(value) {
  return String(value || "").trim();
}

function makeUniqueHeaders(headers) {
  const seen = new Map();

  return headers.map((header, index) => {
    const cleaned = cleanHeader(header) || `Column ${index + 1}`;
    const key = cleaned.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);

    return count ? `${cleaned} ${count + 1}` : cleaned;
  });
}
