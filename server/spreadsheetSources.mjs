import { appendRowToSheet, getSheetValues, updateRowInSheet } from "./sheetsClient.mjs";

const sourceConfigs = {
  costco: {
    defaultSheetNames: ["Account Information", "Transactions", "Rewards Tracker", "Category Summary"],
    defaultSpreadsheetId: "1ChrRfDNyj2h9JC0QzLySVkvXKQzhZjo_5ZutgW063x0",
    headerRows: {
      "Account Information": 2,
      "Rewards Tracker": 3,
      "Category Summary": 3
    },
    label: "Costco",
    sheetNamesEnv: "COSTCO_SHEET_NAMES",
    spreadsheetIdEnv: "COSTCO_SPREADSHEET_ID"
  }
};

export async function listSpreadsheetSource(sourceId) {
  const config = sourceConfig(sourceId);
  const spreadsheetId = configuredSpreadsheetId(config);

  if (!spreadsheetId) {
    return {
      configured: false,
      label: config.label,
      message: `Set ${config.spreadsheetIdEnv} to connect this dashboard section to Google Sheets.`,
      sheets: [],
      source: sourceId,
      success: true
    };
  }

  const sheets = await Promise.all(sheetNames(config).map((sheetName) => readSheet({ config, sheetName, spreadsheetId })));

  return {
    configured: true,
    label: config.label,
    sheets,
    source: sourceId,
    spreadsheetId,
    success: true
  };
}

export async function appendSpreadsheetSourceRow({ sourceId, sheetName, values }) {
  const config = sourceConfig(sourceId);
  const spreadsheetId = configuredSpreadsheetId(config);
  const normalizedSheetName = String(sheetName || sheetNames(config)[0] || "").trim();

  if (!spreadsheetId) {
    throw statusError(`Set ${config.spreadsheetIdEnv} before adding ${config.label} rows.`, 503);
  }

  if (!normalizedSheetName) {
    throw statusError("Sheet name is required.", 400);
  }

  const currentSheet = await readSheet({ config, sheetName: normalizedSheetName, spreadsheetId });
  const headers = currentSheet.headers.filter(Boolean);
  if (!headers.length) {
    throw statusError(`${normalizedSheetName} needs a header row before rows can be appended.`, 400);
  }

  const rowValues = headers.map((header) => values?.[header] ?? "");
  await appendRowToSheet({ spreadsheetId, sheetName: normalizedSheetName, values: rowValues });

  return {
    row: objectFromRow(headers, rowValues, currentSheet.nextRowNumber),
    sheetName: normalizedSheetName,
    source: sourceId,
    success: true
  };
}

export async function updateSpreadsheetSourceRow({ rowNumber, sourceId, sheetName, values }) {
  const config = sourceConfig(sourceId);
  const spreadsheetId = configuredSpreadsheetId(config);
  const normalizedSheetName = String(sheetName || sheetNames(config)[0] || "").trim();
  const safeRowNumber = Number.parseInt(rowNumber, 10);

  if (!spreadsheetId) {
    throw statusError(`Set ${config.spreadsheetIdEnv} before updating ${config.label} rows.`, 503);
  }

  if (!normalizedSheetName) {
    throw statusError("Sheet name is required.", 400);
  }

  if (!Number.isFinite(safeRowNumber) || safeRowNumber < 2) {
    throw statusError("A valid spreadsheet row number is required.", 400);
  }

  const currentSheet = await readSheet({ config, sheetName: normalizedSheetName, spreadsheetId });
  const headers = currentSheet.headers.filter(Boolean);
  if (!headers.length) {
    throw statusError(`${normalizedSheetName} needs a header row before rows can be updated.`, 400);
  }

  const existingRow = currentSheet.rows.find((row) => String(row.id) === String(safeRowNumber)) || {};
  const rowValues = headers.map((header) => values?.[header] ?? existingRow[header] ?? "");
  await updateRowInSheet({ spreadsheetId, sheetName: normalizedSheetName, rowNumber: safeRowNumber, values: rowValues });

  return {
    row: {
      id: String(safeRowNumber),
      ...Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""]))
    },
    sheetName: normalizedSheetName,
    source: sourceId,
    success: true
  };
}

function sourceConfig(sourceId) {
  const config = sourceConfigs[sourceId];
  if (!config) throw statusError(`Unknown spreadsheet source: ${sourceId || "missing"}.`, 404);
  return config;
}

function configuredSpreadsheetId(config) {
  return normalizeSpreadsheetId(process.env[config.spreadsheetIdEnv] || config.defaultSpreadsheetId || "");
}

function sheetNames(config) {
  const configured = process.env[config.sheetNamesEnv];
  const names = configured
    ? configured.split(",").map((name) => name.trim()).filter(Boolean)
    : config.defaultSheetNames;

  return names.length ? names : config.defaultSheetNames;
}

async function readSheet({ config, spreadsheetId, sheetName }) {
  try {
    const values = await getSheetValues({ spreadsheetId, sheetName });
    const headerRowNumber = headerRowNumberForSheet(config, sheetName, values);
    const headerRowIndex = Math.max(headerRowNumber - 1, 0);
    const headers = (values[headerRowIndex] || []).map((value) => String(value || "").trim()).filter(Boolean);
    let lastRowNumber = headerRowNumber;
    const rows = values.slice(headerRowIndex + 1).reduce((records, row, index) => {
      const rowNumber = headerRowNumber + index + 1;
      const record = objectFromRow(headers, row, rowNumber);
      const hasValues = Object.entries(record).some(([key, value]) => key !== "id" && String(value || "").trim());
      if (!hasValues) return records;

      lastRowNumber = rowNumber;
      records.push(record);
      return records;
    }, []);

    return {
      error: "",
      headerRowNumber,
      headers,
      name: sheetName,
      nextRowNumber: lastRowNumber + 1,
      rowCount: rows.length,
      rows
    };
  } catch (error) {
    return {
      error: error.message,
      headerRowNumber: 1,
      headers: [],
      name: sheetName,
      nextRowNumber: 2,
      rowCount: 0,
      rows: []
    };
  }
}

function objectFromRow(headers, row, rowNumber) {
  const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row?.[headerIndex] ?? ""]));
  return {
    id: `${rowNumber}`,
    ...record
  };
}

function headerRowNumberForSheet(config, sheetName, values) {
  const configured = Number(config?.headerRows?.[sheetName]);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return detectHeaderRowNumber(values);
}

function detectHeaderRowNumber(values) {
  const inspectedRows = values.slice(0, 10);
  const firstPlausibleHeader = inspectedRows.findIndex(
    (row) => (row || []).filter((value) => String(value || "").trim()).length >= 2
  );

  return (firstPlausibleHeader === -1 ? 0 : firstPlausibleHeader) + 1;
}

function normalizeSpreadsheetId(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (urlMatch?.[1] || trimmed.split(/[?#]/)[0]).replace(/\/+$/, "");
}

function statusError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
