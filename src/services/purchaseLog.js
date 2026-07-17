const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const CONFIGURED_PURCHASE_ENDPOINT = env.VITE_PURCHASE_LOG_ENDPOINT || "";
const PURCHASE_ENDPOINT = CONFIGURED_PURCHASE_ENDPOINT || "/api/purchases";
const API_ROOT = PURCHASE_ENDPOINT.replace(/\/purchases\/?$/, "") || "/api";
const TRAVEL_SHEETS_ENDPOINT = trimTrailingSlash(env.VITE_TRAVEL_SHEETS_ENDPOINT || "");
const TRAVEL_MASTER_DATA_ENDPOINT = env.VITE_TRAVEL_MASTER_DATA_ENDPOINT || "";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const HAS_PURCHASE_BACKEND = Boolean(CONFIGURED_PURCHASE_ENDPOINT || !IS_GITHUB_PAGES);
const GMAIL_BACKEND_UNCONFIGURED_MESSAGE = "Gmail import backend is not configured for this GitHub Pages deployment.";

export async function appendPurchase(purchase) {
  return postJson(`${API_ROOT}/purchases`, { purchase });
}

export async function listReceiptFolders() {
  return requestJson(`${API_ROOT}/receipt-folders`);
}

export async function createReceiptFolder(folder) {
  return postJson(`${API_ROOT}/receipt-folders`, { folder });
}

export async function listReceipts({ retailer = "", limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });

  if (retailer && retailer !== "all") {
    params.set("retailer", retailer);
  }

  return requestJson(`${API_ROOT}/receipts?${params}`);
}

export async function appendReceipt(receipt) {
  return postJson(`${API_ROOT}/receipts`, { receipt });
}

export async function uploadReceiptFile(file) {
  const data = await readFileAsDataUrl(file);
  return postJson(`${API_ROOT}/receipt-files`, {
    file: {
      contentType: file.type || "application/octet-stream",
      data,
      fileName: file.name
    }
  });
}

export async function getGoogleOAuthStatus() {
  if (!HAS_PURCHASE_BACKEND) {
    return {
      authenticated: false,
      configured: false,
      unavailableReason: GMAIL_BACKEND_UNCONFIGURED_MESSAGE
    };
  }

  return requestJson(`${API_ROOT}/google/oauth/status`);
}

export async function getGoogleOAuthUrl() {
  requirePurchaseBackend("Google OAuth");
  return requestJson(`${API_ROOT}/google/oauth/url`);
}

export async function listCostcoOrders({ limit = 500 } = {}) {
  if (!HAS_PURCHASE_BACKEND) {
    return { orders: [], success: true };
  }

  return requestJson(`${API_ROOT}/costco-orders?${new URLSearchParams({ limit: String(limit) })}`);
}

export async function importCostcoOrders({ limit = 500, query = "", limitPerBatch = "", historyStartYear = "", historyEndYear = "" } = {}) {
  requirePurchaseBackend("Costco Gmail import");
  return postJson(`${API_ROOT}/costco-orders/import`, { limit, query, limitPerBatch, historyStartYear, historyEndYear });
}

export async function clearCostcoOrders() {
  requirePurchaseBackend("Costco Gmail import");
  return postJson(`${API_ROOT}/costco-orders/clear`, {});
}

export async function listUsMintOrders({ limit = 500 } = {}) {
  if (!HAS_PURCHASE_BACKEND) {
    return { orders: [], success: true };
  }

  return requestJson(`${API_ROOT}/us-mint-orders?${new URLSearchParams({ limit: String(limit) })}`);
}

export async function importUsMintOrders({ limit = 500, query = "", limitPerBatch = "", historyStartYear = "", historyEndYear = "" } = {}) {
  requirePurchaseBackend("US Mint Gmail import");
  return postJson(`${API_ROOT}/us-mint-orders/import`, { limit, query, limitPerBatch, historyStartYear, historyEndYear });
}

export async function clearUsMintOrders() {
  requirePurchaseBackend("US Mint Gmail import");
  return postJson(`${API_ROOT}/us-mint-orders/clear`, {});
}

export async function listTravelSheets() {
  if (TRAVEL_SHEETS_ENDPOINT) {
    return requestJson(TRAVEL_SHEETS_ENDPOINT);
  }

  return requestJson(`${API_ROOT}/travel/sheets`);
}

export async function listTravelMasterData() {
  if (TRAVEL_MASTER_DATA_ENDPOINT) {
    return requestJson(TRAVEL_MASTER_DATA_ENDPOINT);
  }

  return requestJson(`${API_ROOT}/travel/master-data`);
}

export async function appendTravelSheetRow({ sheetName, values }) {
  if (TRAVEL_SHEETS_ENDPOINT) {
    return postJson(`${TRAVEL_SHEETS_ENDPOINT}/${encodeURIComponent(sheetName)}/rows`, { values });
  }

  return postJson(`${API_ROOT}/travel/sheets/${encodeURIComponent(sheetName)}/rows`, { values });
}

async function postJson(url, payload) {
  return requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = parseJsonResponse(text, response);

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error || body?.message || `Request failed with status ${response.status}.`);
  }

  return body;
}

function parseJsonResponse(text, response) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const isHtml = /<!doctype html|<html[\s>]/i.test(text);
    const detail = isHtml ? "HTML" : "a non-JSON response";
    throw new Error(`API returned ${detail} for ${response.url}. Check the deployed API endpoint configuration.`);
  }
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function requirePurchaseBackend(feature) {
  if (HAS_PURCHASE_BACKEND) return;

  throw new Error(`${feature} is unavailable. ${GMAIL_BACKEND_UNCONFIGURED_MESSAGE}`);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file.")));
    reader.readAsDataURL(file);
  });
}
