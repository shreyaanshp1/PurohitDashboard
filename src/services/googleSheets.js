const APPS_SCRIPT_URL = import.meta.env?.VITE_GOOGLE_SHEETS_WEB_APP_URL || "";
const BACKEND_ENDPOINT = import.meta.env?.VITE_PURCHASE_LOG_ENDPOINT || "";
const SHEET_ID = import.meta.env?.VITE_GOOGLE_SHEET_ID || "";
const SHEET_NAME = import.meta.env?.VITE_GOOGLE_SHEET_NAME || "Purchases";
const SHARED_SECRET = import.meta.env?.VITE_GOOGLE_SHEETS_SHARED_SECRET || "";

export const PURCHASE_COLUMNS = [
  "Date",
  "Store Name",
  "Total Amount",
  "Category",
  "Items/Notes",
  "Rewards Earned"
];

export function normalizePurchaseForSheet(purchase) {
  const totalAmount = toMoneyNumber(purchase.totalAmount ?? purchase.amount);
  const rewardsEarned = toMoneyNumber(purchase.rewardsEarned ?? 0);
  const storeName = String(purchase.storeName ?? purchase.store ?? "").trim();
  const category = String(purchase.category ?? "").trim();
  const itemsNotes = String(purchase.itemsNotes ?? purchase.notes ?? "").trim();
  const date = purchase.date || new Date().toISOString().slice(0, 10);

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Total amount must be greater than 0.");
  }

  if (!category) {
    throw new Error("Category is required.");
  }

  return {
    date,
    storeName,
    totalAmount,
    category,
    itemsNotes,
    rewardsEarned
  };
}

export function buildPurchaseRow(purchase) {
  const normalized = normalizePurchaseForSheet(purchase);

  return [
    normalized.date,
    normalized.storeName,
    normalized.totalAmount,
    normalized.category,
    normalized.itemsNotes,
    normalized.rewardsEarned
  ];
}

export async function appendPurchaseToSheet(purchase) {
  const endpoint = BACKEND_ENDPOINT || APPS_SCRIPT_URL;

  if (!endpoint) {
    throw new Error(
      "Missing VITE_GOOGLE_SHEETS_WEB_APP_URL or VITE_PURCHASE_LOG_ENDPOINT in your environment."
    );
  }

  const normalizedPurchase = normalizePurchaseForSheet(purchase);
  const payload = {
    sheetId: SHEET_ID,
    sheetName: SHEET_NAME,
    secret: SHARED_SECRET,
    columns: PURCHASE_COLUMNS,
    purchase: normalizedPurchase
  };

  const isAppsScript = endpoint.includes("script.google.com");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": isAppsScript ? "text/plain;charset=utf-8" : "application/json"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  const body = parseGoogleSheetsResponse(bodyText);

  if (!response.ok || body?.success === false) {
    const message = body?.error || body?.message || `Google Sheets request failed (${response.status}).`;
    throw new Error(message);
  }

  return body || { success: true };
}

function toMoneyNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const normalized = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : Number.NaN;
}

export function parseGoogleSheetsResponse(text) {
  if (!text) {
    throw new Error("Google Sheets endpoint returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(text);

    if (looksLikeHtml) {
      throw new Error(
        "Apps Script returned an HTML page instead of JSON. Re-deploy the web app with access that allows this dashboard to call it."
      );
    }

    throw new Error("Google Sheets endpoint returned a non-JSON response.");
  }
}
