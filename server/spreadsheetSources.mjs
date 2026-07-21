import { appendRowToSheet, getSheetValues, updateRowInSheet } from "./sheetsClient.mjs";

const sourceConfigs = {
  alerts: {
    defaultSheetNames: ["Alerts"],
    label: "Alerts",
    sheetNamesEnv: "ALERTS_SHEET_NAMES",
    spreadsheetIdEnv: "ALERTS_SPREADSHEET_ID"
  },
  buyers: {
    defaultSheetNames: ["Buyers"],
    label: "Buyers",
    sheetNamesEnv: "BUYERS_SHEET_NAMES",
    spreadsheetIdEnv: "BUYERS_SPREADSHEET_ID"
  },
  commodities: {
    defaultSheetNames: ["Inventory", "Sales"],
    label: "Commodities",
    sheetNamesEnv: "COMMODITIES_SHEET_NAMES",
    spreadsheetIdEnv: "COMMODITIES_SPREADSHEET_ID"
  },
  costco: {
    defaultSheetNames: ["Accounts", "Transactions", "Orders", "Rewards", "Renewals"],
    label: "Costco",
    sheetNamesEnv: "COSTCO_SHEET_NAMES",
    spreadsheetIdEnv: "COSTCO_SPREADSHEET_ID"
  },
  dell: {
    defaultSheetNames: ["Accounts", "Orders", "Items", "Rewards", "Fulfillment", "Sales"],
    label: "Dell",
    sheetNamesEnv: "DELL_SHEET_NAMES",
    spreadsheetIdEnv: "DELL_SPREADSHEET_ID"
  },
  reports: {
    defaultSheetNames: ["Reports"],
    label: "Reports",
    sheetNamesEnv: "REPORTS_SHEET_NAMES",
    spreadsheetIdEnv: "REPORTS_SPREADSHEET_ID"
  },
  rewards: {
    defaultSheetNames: ["Rewards"],
    label: "Rewards",
    sheetNamesEnv: "REWARDS_SHEET_NAMES",
    spreadsheetIdEnv: "REWARDS_SPREADSHEET_ID"
  },
  usMint: {
    defaultSheetNames: ["Accounts", "Orders", "Release Calendar", "Subscriptions", "Expected Charges", "Buyer Sales"],
    label: "US Mint",
    sheetNamesEnv: "US_MINT_SHEET_NAMES",
    spreadsheetIdEnv: "US_MINT_SPREADSHEET_ID"
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

  const sheets = await Promise.all(sheetNames(config).map((sheetName) => readSheet({ sheetName, spreadsheetId })));

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

  const currentSheet = await readSheet({ sheetName: normalizedSheetName, spreadsheetId });
  const headers = currentSheet.headers.filter(Boolean);
  if (!headers.length) {
    throw statusError(`${normalizedSheetName} needs a header row before rows can be appended.`, 400);
  }

  const rowValues = headers.map((header) => values?.[header] ?? "");
  await appendRowToSheet({ spreadsheetId, sheetName: normalizedSheetName, values: rowValues });

  return {
    row: objectFromRow(headers, rowValues, currentSheet.rows.length),
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

  const currentSheet = await readSheet({ sheetName: normalizedSheetName, spreadsheetId });
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
  return normalizeSpreadsheetId(process.env[config.spreadsheetIdEnv] || "");
}

function sheetNames(config) {
  const configured = process.env[config.sheetNamesEnv];
  const names = configured
    ? configured.split(",").map((name) => name.trim()).filter(Boolean)
    : config.defaultSheetNames;

  return names.length ? names : config.defaultSheetNames;
}

async function readSheet({ spreadsheetId, sheetName }) {
  try {
    const values = await getSheetValues({ spreadsheetId, sheetName });
    const headers = (values[0] || []).map((value) => String(value || "").trim()).filter(Boolean);
    const rows = values
      .slice(1)
      .map((row, index) => objectFromRow(headers, row, index))
      .filter((row) => Object.entries(row).some(([key, value]) => key !== "id" && String(value || "").trim()));

    return {
      error: "",
      headers,
      name: sheetName,
      rowCount: rows.length,
      rows
    };
  } catch (error) {
    return {
      error: error.message,
      headers: [],
      name: sheetName,
      rowCount: 0,
      rows: []
    };
  }
}

function objectFromRow(headers, row, index) {
  const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row?.[headerIndex] ?? ""]));
  return {
    id: `${index + 2}`,
    ...record
  };
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
