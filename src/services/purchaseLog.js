const CONFIGURED_PURCHASE_ENDPOINT = import.meta.env?.VITE_PURCHASE_LOG_ENDPOINT || "";
const PURCHASE_ENDPOINT = CONFIGURED_PURCHASE_ENDPOINT || "/api/purchases";
const API_ROOT = PURCHASE_ENDPOINT.replace(/\/purchases\/?$/, "") || "/api";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const HAS_PURCHASE_BACKEND = Boolean(CONFIGURED_PURCHASE_ENDPOINT || !IS_GITHUB_PAGES);
const BACKEND_UNCONFIGURED_MESSAGE = "Private API backend is not configured for this deployment.";

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

export async function listSpreadsheetSource(source) {
  if (!HAS_PURCHASE_BACKEND) {
    return {
      configured: false,
      message: "Spreadsheet backend is not configured for this deployment.",
      sheets: [],
      source,
      success: true
    };
  }

  return requestJson(`${API_ROOT}/spreadsheets/${encodeURIComponent(source)}`);
}

export async function appendSpreadsheetSourceRow({ source, sheetName, values }) {
  requirePurchaseBackend("Google Sheets logging");
  return postJson(`${API_ROOT}/spreadsheets/${encodeURIComponent(source)}/${encodeURIComponent(sheetName)}/rows`, { values });
}

export async function updateSpreadsheetSourceRow({ rowNumber, source, sheetName, values }) {
  requirePurchaseBackend("Google Sheets row updates");
  return requestJson(
    `${API_ROOT}/spreadsheets/${encodeURIComponent(source)}/${encodeURIComponent(sheetName)}/rows/${encodeURIComponent(rowNumber)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values })
    }
  );
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

function requirePurchaseBackend(feature) {
  if (HAS_PURCHASE_BACKEND) return;

  throw new Error(`${feature} is unavailable. ${BACKEND_UNCONFIGURED_MESSAGE}`);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file.")));
    reader.readAsDataURL(file);
  });
}
