import { appendRowToSheet, getSheetValues } from "./sheetsClient.mjs";

const DEFAULT_TRAVEL_SHEET_NAMES = ["Trips", "Flights", "Certificates_Awards"];

const DEFAULT_HEADERS_BY_SHEET = {
  Trips: ["Trip", "Destination", "Start Date", "End Date", "Status", "Budget", "Notes"],
  Flights: ["Flight", "From", "To", "Depart Date", "Depart Time", "Airline", "Confirmation", "Status", "Notes"],
  Certificates_Awards: ["Program", "Account", "Certificate/Award", "Value", "Expiration Date", "Status", "Notes"]
};

export async function listTravelSheets() {
  const spreadsheetId = getTravelSpreadsheetId();
  const sheetNames = getTravelSheetNames();
  const sheets = await Promise.all(sheetNames.map((sheetName) => readTravelSheet({ spreadsheetId, sheetName })));

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    spreadsheetId,
    sheets
  };
}

export async function appendTravelSheetRow({ sheetName, values }) {
  assertAllowedSheetName(sheetName);

  const spreadsheetId = getTravelSpreadsheetId();
  const sheet = await readTravelSheet({ spreadsheetId, sheetName });
  const rowValues = buildRowValues(sheet.headers, values);
  const appendResult = await appendRowToSheet({ spreadsheetId, sheetName, values: rowValues });

  return {
    success: true,
    sheetName,
    row: Object.fromEntries(sheet.headers.map((header, index) => [header, rowValues[index] || ""])),
    updatedRange: appendResult.updatedRange
  };
}

async function readTravelSheet({ spreadsheetId, sheetName }) {
  assertAllowedSheetName(sheetName);

  const values = await getSheetValues({ spreadsheetId, sheetName });
  return normalizeSheetValues(sheetName, values);
}

function normalizeSheetValues(sheetName, values) {
  const rows = Array.isArray(values) ? values : [];
  const defaultHeaders = DEFAULT_HEADERS_BY_SHEET[sheetName] || [];
  const headerRow = rows[0] || [];
  const width = Math.max(headerRow.length, defaultHeaders.length, ...rows.map((row) => row.length));
  const headers = makeUniqueHeaders(
    Array.from({ length: width }, (_, index) => cleanHeader(headerRow[index]) || defaultHeaders[index] || `Column ${index + 1}`)
  );
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));

  return {
    name: sheetName,
    headers,
    rows: dataRows.map((row, rowIndex) => {
      const normalizedRow = { id: `${sheetName}-${rowIndex + 2}` };

      headers.forEach((header, columnIndex) => {
        normalizedRow[header] = row[columnIndex] || "";
      });

      return normalizedRow;
    }),
    rowCount: dataRows.length
  };
}

function buildRowValues(headers, values) {
  if (Array.isArray(values)) return values;

  const rowValues = headers.map((header) => {
    const directValue = values?.[header];
    const normalizedValue = values?.[normalizeKey(header)];
    const value = directValue ?? normalizedValue ?? "";

    if (!value && /^logged\s+at$/i.test(header)) {
      return new Date().toISOString();
    }

    return value;
  });

  if (!rowValues.some((value) => String(value || "").trim())) {
    const error = new Error("At least one travel row value is required.");
    error.statusCode = 400;
    throw error;
  }

  return rowValues;
}

function getTravelSpreadsheetId() {
  const spreadsheetId = process.env.TRAVEL_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing TRAVEL_SPREADSHEET_ID.");
  return spreadsheetId;
}

function getTravelSheetNames() {
  const configuredNames = process.env.TRAVEL_SHEET_NAMES;
  if (!configuredNames) return DEFAULT_TRAVEL_SHEET_NAMES;

  return configuredNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function assertAllowedSheetName(sheetName) {
  if (getTravelSheetNames().includes(sheetName)) return;

  const error = new Error(`Unknown travel sheet: ${sheetName || "missing"}.`);
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

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, letter) => letter.toUpperCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
}
