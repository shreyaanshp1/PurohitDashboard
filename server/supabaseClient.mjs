import { normalizePurchase } from "./purchaseData.mjs";

export async function appendPurchaseToSupabase(purchase) {
  const normalized = normalizePurchase(purchase);
  const row = toSupabaseRow(normalized);
  const response = await fetch(`${supabaseUrl()}/rest/v1/purchases`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(row)
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    purchase: normalized,
    record: data?.[0] || null
  };
}

export async function listRecentPurchasesFromSupabase(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const url = `${supabaseUrl()}/rest/v1/purchases?select=*&order=created_at.desc&limit=${safeLimit}`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    purchases: data
  };
}

export async function listReceiptFoldersFromSupabase() {
  const url = `${supabaseUrl()}/rest/v1/receipt_folders?select=*&order=name.asc&limit=100`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    folders: data.map(fromReceiptFolderRow)
  };
}

export async function createReceiptFolderInSupabase(folder) {
  const normalized = normalizeReceiptFolder(folder);
  const existing = (await listReceiptFoldersFromSupabase()).folders.find(
    (current) => current.name.toLowerCase() === normalized.name.toLowerCase()
  );

  if (existing) {
    return {
      success: true,
      folder: existing,
      existed: true
    };
  }

  const response = await fetch(`${supabaseUrl()}/rest/v1/receipt_folders`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify({
      name: normalized.name,
      retailer: normalized.retailer
    })
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    folder: fromReceiptFolderRow(data?.[0] || {}),
    existed: false
  };
}

export async function listReceiptsFromSupabase({ limit = 100, retailer = "" } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const normalizedRetailer = String(retailer || "").trim().toLowerCase();
  const url = `${supabaseUrl()}/rest/v1/receipts?select=*&order=created_at.desc&limit=${safeLimit}`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);
  const receipts = data.map(fromReceiptRow).filter((receipt) => {
    if (!normalizedRetailer || normalizedRetailer === "all") return true;
    return receipt.retailer.toLowerCase() === normalizedRetailer;
  });

  return {
    success: true,
    receipts
  };
}

export async function appendReceiptToSupabase(receipt) {
  const normalized = normalizeReceipt(receipt);
  const folderResult = await createReceiptFolderInSupabase({
    name: normalized.folderName,
    retailer: normalized.retailer
  });
  const response = await fetch(`${supabaseUrl()}/rest/v1/receipts`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify({
      receipt_date: normalized.date,
      retailer: normalized.retailer,
      folder_id: toNumericId(folderResult.folder.id),
      folder_name: folderResult.folder.name,
      total_amount: normalized.totalAmount === "" ? null : normalized.totalAmount,
      receipt_url: normalized.receiptUrl || null,
      receipt_file_name: normalized.receiptFileName || null,
      receipt_content_type: normalized.receiptContentType || null,
      notes: normalized.notes || null
    })
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    folder: folderResult.folder,
    receipt: fromReceiptRow(data?.[0] || {}),
    record: data?.[0] || null
  };
}

function toSupabaseRow(purchase) {
  return {
    purchase_date: purchase.date,
    store_name: purchase.storeName,
    total_amount: purchase.totalAmount,
    category: purchase.category,
    items_notes: purchase.itemsNotes,
    rewards_earned: purchase.rewardsEarned
  };
}

function fromReceiptFolderRow(row) {
  const name = row.name || row.retailer || "";

  return {
    id: String(row.id || ""),
    name,
    retailer: row.retailer || name,
    createdAt: row.created_at || ""
  };
}

function fromReceiptRow(row) {
  return {
    id: String(row.id || ""),
    date: row.receipt_date || "",
    retailer: row.retailer || "",
    folder: row.folder_name || row.retailer || "",
    totalAmount: row.total_amount ?? "",
    receiptUrl: row.receipt_url || "",
    receiptFileName: row.receipt_file_name || "",
    receiptContentType: row.receipt_content_type || "",
    notes: row.notes || "",
    loggedAt: row.created_at || ""
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
  const receiptFileName = String(receipt.receiptFileName ?? receipt.fileName ?? "").trim();
  const receiptContentType = String(receipt.receiptContentType ?? receipt.contentType ?? "").trim();
  const notes = String(receipt.notes ?? receipt.itemsNotes ?? "").trim();
  const date = receipt.date || new Date().toISOString().slice(0, 10);

  if (!retailer) throw new Error("Retailer is required.");
  if (!folderName) throw new Error("Retailer folder is required.");
  if (totalAmount !== "" && (!Number.isFinite(totalAmount) || totalAmount < 0)) {
    throw new Error("Total amount must be a valid positive number.");
  }
  if (!receiptUrl && !receiptFileName && !notes && totalAmount === "") {
    throw new Error("Add a receipt file, notes, or total amount.");
  }

  return {
    date,
    retailer,
    folderName,
    totalAmount,
    receiptUrl,
    receiptFileName,
    receiptContentType,
    notes
  };
}

function toOptionalMoneyNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const normalized = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : Number.NaN;
}

function toNumericId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
}

export function supabaseUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw supabaseConfigError(
      "Supabase is not configured. Set SUPABASE_URL in .env.local, then restart npm run dev."
    );
  }
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function supabaseServerKey() {
  const candidates = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
  const serverKey = candidates.find((key) => isServerSupabaseKey(key));

  if (serverKey) return serverKey;

  if (candidates.length) {
    throw supabaseConfigError("Configured Supabase key is publishable/anon. Use SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
  }

  throw supabaseConfigError(
    "Supabase service key is not configured. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local, then restart npm run dev."
  );
}

export function supabaseHeaders(options = {}) {
  const key = supabaseServerKey();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}

export async function parseSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || `Supabase request failed with status ${response.status}.`);
  }

  return data;
}

function isServerSupabaseKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("sb_publishable_")) return false;

  const role = getJwtRole(key);
  if (role === "service_role") return true;
  if (role === "anon") return false;

  return false;
}

function getJwtRole(key) {
  const [, payload] = key.split(".");
  if (!payload) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(json).role || null;
  } catch {
    return null;
  }
}

function supabaseConfigError(message) {
  const error = new Error(message);
  error.code = "SUPABASE_NOT_CONFIGURED";
  error.statusCode = 503;
  return error;
}
