import { normalizePurchase } from "./purchaseData.mjs";

// Archived integration. The active API routes use Supabase from
// `server/supabaseClient.mjs`; this file is kept only for reference.
const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export function hasAirtableConfig() {
  return Boolean(process.env.AIRTABLE_BASE_ID && airtableToken());
}

export async function appendPurchaseToAirtable(purchase) {
  const normalized = normalizePurchase(purchase);
  const record = await createAirtableRecord(airtableTable("AIRTABLE_PURCHASES_TABLE", "Purchases"), {
    Date: normalized.date,
    "Store Name": normalized.storeName,
    "Total Amount": normalized.totalAmount,
    Category: normalized.category,
    "Items/Notes": normalized.itemsNotes,
    "Rewards Earned": normalized.rewardsEarned,
    "Logged At": new Date().toISOString()
  });

  return {
    success: true,
    purchase: normalized,
    record
  };
}

export async function listRecentPurchasesFromAirtable(limit = 50) {
  const records = await listAirtableRecords(airtableTable("AIRTABLE_PURCHASES_TABLE", "Purchases"), {
    maxRecords: boundedLimit(limit)
  });

  return {
    success: true,
    purchases: records.map(fromPurchaseRecord)
  };
}

export async function listReceiptFoldersFromAirtable() {
  const records = await listAirtableRecords(airtableTable("AIRTABLE_RECEIPT_FOLDERS_TABLE", "Receipt Folders"), {
    maxRecords: 100
  });

  const folders = records.map(fromFolderRecord).sort((a, b) => a.name.localeCompare(b.name));

  return {
    success: true,
    folders
  };
}

export async function createReceiptFolderInAirtable(folder) {
  const normalized = normalizeReceiptFolder(folder);
  const existing = (await listReceiptFoldersFromAirtable()).folders.find(
    (current) => current.name.toLowerCase() === normalized.name.toLowerCase()
  );

  if (existing) {
    return {
      success: true,
      folder: existing,
      existed: true
    };
  }

  const record = await createAirtableRecord(airtableTable("AIRTABLE_RECEIPT_FOLDERS_TABLE", "Receipt Folders"), {
    Name: normalized.name,
    Retailer: normalized.retailer,
    "Created At": new Date().toISOString()
  });

  return {
    success: true,
    folder: fromFolderRecord(record),
    existed: false
  };
}

export async function listReceiptsFromAirtable({ limit = 100, retailer = "" } = {}) {
  const normalizedRetailer = String(retailer || "").trim().toLowerCase();
  const records = await listAirtableRecords(airtableTable("AIRTABLE_RECEIPTS_TABLE", "Receipts"), {
    maxRecords: boundedLimit(limit, 100)
  });
  const receipts = records.map(fromReceiptRecord).filter((receipt) => {
    if (!normalizedRetailer || normalizedRetailer === "all") return true;
    return receipt.retailer.toLowerCase() === normalizedRetailer;
  });

  return {
    success: true,
    receipts
  };
}

export async function appendReceiptToAirtable(receipt) {
  const normalized = normalizeReceipt(receipt);
  const folderResult = await createReceiptFolderInAirtable({
    name: normalized.folderName,
    retailer: normalized.retailer
  });
  const record = await createAirtableRecord(airtableTable("AIRTABLE_RECEIPTS_TABLE", "Receipts"), {
    Date: normalized.date,
    Retailer: normalized.retailer,
    Folder: folderResult.folder.name,
    "Total Amount": normalized.totalAmount,
    "Receipt URL": normalized.receiptUrl,
    Notes: normalized.notes,
    "Logged At": new Date().toISOString()
  });

  return {
    success: true,
    folder: folderResult.folder,
    receipt: fromReceiptRecord(record),
    record
  };
}

function fromPurchaseRecord(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    date: fields.Date || "",
    storeName: fields["Store Name"] || "",
    totalAmount: fields["Total Amount"] ?? "",
    category: fields.Category || "",
    itemsNotes: fields["Items/Notes"] || "",
    rewardsEarned: fields["Rewards Earned"] ?? "",
    loggedAt: fields["Logged At"] || ""
  };
}

function fromFolderRecord(record) {
  const fields = record.fields || {};
  const name = fields.Name || fields.Retailer || "";

  return {
    id: record.id,
    name,
    retailer: fields.Retailer || name,
    createdAt: fields["Created At"] || ""
  };
}

function fromReceiptRecord(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    date: fields.Date || "",
    retailer: fields.Retailer || "",
    folder: fields.Folder || fields.Retailer || "",
    totalAmount: fields["Total Amount"] ?? "",
    receiptUrl: fields["Receipt URL"] || firstAttachmentUrl(fields.Attachments),
    notes: fields.Notes || "",
    loggedAt: fields["Logged At"] || ""
  };
}

function normalizeReceiptFolder(folder) {
  const retailer = String(folder.retailer ?? folder.name ?? "").trim();
  const name = String(folder.name ?? retailer).trim();

  if (!name) throw new Error("Retailer folder name is required.");

  return {
    name,
    retailer: retailer || name
  };
}

function normalizeReceipt(receipt) {
  const retailer = String(receipt.retailer ?? receipt.storeName ?? receipt.store ?? "").trim();
  const folderName = String(receipt.folderName ?? receipt.folder ?? retailer).trim();
  const totalAmount = toOptionalMoneyNumber(receipt.totalAmount ?? receipt.amount);
  const receiptUrl = String(receipt.receiptUrl ?? receipt.url ?? "").trim();
  const notes = String(receipt.notes ?? receipt.itemsNotes ?? "").trim();
  const date = receipt.date || new Date().toISOString().slice(0, 10);

  if (!retailer) throw new Error("Retailer is required.");
  if (!folderName) throw new Error("Retailer folder is required.");
  if (totalAmount !== "" && (!Number.isFinite(totalAmount) || totalAmount < 0)) {
    throw new Error("Total amount must be a valid positive number.");
  }
  if (!receiptUrl && !notes && totalAmount === "") {
    throw new Error("Add a receipt link, notes, or total amount.");
  }

  return {
    date,
    retailer,
    folderName,
    totalAmount,
    receiptUrl,
    notes
  };
}

async function createAirtableRecord(table, fields) {
  const response = await fetch(airtableUrl(table), {
    method: "POST",
    headers: airtableHeaders(),
    body: JSON.stringify({
      records: [
        {
          fields: cleanFields(fields)
        }
      ]
    })
  });
  const data = await parseAirtableResponse(response);

  return data.records?.[0] || null;
}

async function listAirtableRecords(table, { maxRecords = 100 } = {}) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams({
      maxRecords: String(maxRecords),
      pageSize: String(Math.min(maxRecords, 100))
    });

    if (offset) {
      params.set("offset", offset);
    }

    const response = await fetch(`${airtableUrl(table)}?${params}`, {
      headers: airtableHeaders()
    });
    const data = await parseAirtableResponse(response);

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset && records.length < maxRecords);

  return records.slice(0, maxRecords);
}

async function parseAirtableResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || data.error?.type || `Airtable request failed with status ${response.status}.`);
  }

  return data;
}

function airtableUrl(table) {
  return `${AIRTABLE_API_BASE}/${encodeURIComponent(requiredEnv("AIRTABLE_BASE_ID"))}/${encodeURIComponent(table)}`;
}

function airtableHeaders() {
  const token = airtableToken();
  if (!token) throw new Error("Missing AIRTABLE_PERSONAL_ACCESS_TOKEN.");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

function airtableToken() {
  return process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || "";
}

function airtableTable(envKey, fallback) {
  return process.env[envKey] || fallback;
}

function boundedLimit(limit, max = 100) {
  return Math.min(Math.max(Number(limit) || max, 1), max);
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

function firstAttachmentUrl(value) {
  return Array.isArray(value) ? value[0]?.url || "" : "";
}

function toOptionalMoneyNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const normalized = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : Number.NaN;
}

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}
