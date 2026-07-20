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

export async function listCostcoOrdersFromSupabase(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const url = `${supabaseUrl()}/rest/v1/costco_orders?select=*&order=received_at.desc&limit=${safeLimit}`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    orders: data.map(fromCostcoOrderRow)
  };
}

export async function clearCostcoOrdersFromSupabase() {
  const response = await fetch(`${supabaseUrl()}/rest/v1/costco_orders?id=not.is.null`, {
    method: "DELETE",
    headers: supabaseHeaders({ prefer: "return=representation" })
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    deleted: Array.isArray(data) ? data.length : 0
  };
}

export async function upsertCostcoOrderToSupabase(order) {
  const row = toCostcoOrderRow(order);
  const response = await fetch(`${supabaseUrl()}/rest/v1/costco_orders?on_conflict=source_message_id`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(row)
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    order: fromCostcoOrderRow(data?.[0] || row),
    record: data?.[0] || null
  };
}

export async function listUsMintOrdersFromSupabase(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const url = `${supabaseUrl()}/rest/v1/us_mint_orders?select=*&order=received_at.desc&limit=${safeLimit}`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    orders: data.map(fromUsMintOrderRow)
  };
}

export async function clearUsMintOrdersFromSupabase() {
  const response = await fetch(`${supabaseUrl()}/rest/v1/us_mint_orders?id=not.is.null`, {
    method: "DELETE",
    headers: supabaseHeaders({ prefer: "return=representation" })
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    deleted: Array.isArray(data) ? data.length : 0
  };
}

export async function upsertUsMintOrderToSupabase(order) {
  const row = toUsMintOrderRow(order);
  const response = await fetch(`${supabaseUrl()}/rest/v1/us_mint_orders?on_conflict=source_message_id`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(row)
  });
  const data = await parseSupabaseResponse(response);

  return {
    success: true,
    order: fromUsMintOrderRow(data?.[0] || row),
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

function fromCostcoOrderRow(row) {
  const subtotal =
    row.subtotal_amount === null || row.subtotal_amount === undefined ? "" : formatMoney(row.subtotal_amount);
  const tax = row.tax_amount === null || row.tax_amount === undefined ? "" : formatMoney(row.tax_amount);
  const total = row.total_amount === null || row.total_amount === undefined ? "" : formatMoney(row.total_amount);
  const itemName = cleanCostcoItemName(row.item_name || "");
  const itemDisplay = itemName || (row.item_number ? `Item # ${row.item_number}` : "");

  return {
    id: String(row.id || ""),
    sourceMessageId: row.source_message_id || "",
    receivedAt: row.received_at || "",
    accountEmail: row.account_email || "",
    orderNumber: row.order_number_display || "",
    orderNumberLast4: row.order_number_last4 || "",
    order: row.order_number_display || (row.order_number_last4 ? `ending ${row.order_number_last4}` : ""),
    orderDate: row.order_date_text || "",
    date: row.order_date_text || dateOnly(row.received_at),
    membershipNumber: row.membership_number_display || "",
    membershipNumberLast4: row.membership_number_last4 || "",
    membership: row.membership_number_display || (row.membership_number_last4 ? `ending ${row.membership_number_last4}` : ""),
    account: row.account_email || "",
    item: itemDisplay,
    itemName,
    itemNumber: row.item_number || "",
    quantity: row.quantity || "",
    unitPrice: row.unit_price_amount === null || row.unit_price_amount === undefined ? "" : formatMoney(row.unit_price_amount),
    subtotal,
    subtotalAmount: row.subtotal_amount ?? "",
    tax,
    taxAmount: row.tax_amount ?? "",
    shippingHandling:
      row.shipping_handling_amount === null || row.shipping_handling_amount === undefined
        ? ""
        : formatMoney(row.shipping_handling_amount),
    total,
    totalAmount: row.total_amount ?? "",
    status: row.status || "",
    action: row.next_action || "",
    nextAction: row.next_action || "",
    importedAt: row.updated_at || row.created_at || ""
  };
}

function fromUsMintOrderRow(row) {
  const subtotal =
    row.subtotal_amount === null || row.subtotal_amount === undefined ? "" : formatMoney(row.subtotal_amount);
  const total = row.total_amount === null || row.total_amount === undefined ? "" : formatMoney(row.total_amount);

  return {
    id: String(row.id || ""),
    sourceMessageId: row.source_message_id || "",
    receivedAt: row.received_at || "",
    accountEmail: row.account_email || "",
    account: row.account_email || "",
    orderNumber: row.order_number || "",
    order: row.order_number || "",
    orderDate: row.order_date_text || "",
    date: row.order_date_text || dateOnly(row.received_at),
    itemName: row.item_name || "",
    item: row.item_name || "",
    itemDescription: row.item_description || "",
    unitOfMeasure: row.unit_of_measure || "---",
    unitType: row.unit_of_measure || "---",
    quantity: row.quantity || "",
    subtotal,
    subtotalAmount: row.subtotal_amount ?? "",
    total,
    totalAmount: row.total_amount ?? "",
    status: row.status || "",
    action: row.next_action || "",
    nextAction: row.next_action || "",
    importedAt: row.updated_at || row.created_at || ""
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

function toCostcoOrderRow(order) {
  return {
    source_message_id: requiredString(order.sourceMessageId, "Costco Gmail message ID is required."),
    received_at: order.receivedAt || null,
    account_email: order.accountEmail || null,
    order_number_display: order.orderNumber || null,
    order_number_last4: order.orderNumberLast4 || null,
    order_date_text: order.orderDate || null,
    membership_number_display: order.membershipNumber || null,
    membership_number_last4: order.membershipNumberLast4 || null,
    item_name: cleanCostcoItemName(order.itemName) || null,
    item_number: order.itemNumber || null,
    quantity: order.quantity || null,
    unit_price_amount: toNullableMoneyNumber(order.unitPrice),
    subtotal_amount: toNullableMoneyNumber(order.subtotal),
    shipping_handling_amount: toNullableMoneyNumber(order.shippingHandling),
    tax_amount: toNullableMoneyNumber(order.tax),
    total_amount: toNullableMoneyNumber(order.total),
    status: order.status || "Imported",
    next_action: order.nextAction || null,
    updated_at: new Date().toISOString()
  };
}

function toUsMintOrderRow(order) {
  return {
    source_message_id: requiredString(order.sourceMessageId, "US Mint Gmail message ID is required."),
    received_at: order.receivedAt || null,
    account_email: order.accountEmail || null,
    order_number: order.orderNumber || null,
    order_date_text: order.orderDate || null,
    item_name: order.itemName || null,
    item_description: order.itemDescription || null,
    unit_of_measure: order.unitOfMeasure || null,
    quantity: order.quantity || null,
    subtotal_amount: toNullableMoneyNumber(order.subtotal),
    total_amount: toNullableMoneyNumber(order.total),
    status: order.status || "Imported",
    next_action: order.nextAction || null,
    updated_at: new Date().toISOString()
  };
}

function toOptionalMoneyNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const normalized = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : Number.NaN;
}

function toNullableMoneyNumber(value) {
  const amount = toOptionalMoneyNumber(value);
  return Number.isFinite(amount) ? amount : null;
}

function cleanCostcoItemName(value) {
  const cleaned = String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(zwnj|zwj|ZeroWidthSpace);|&#820[3-5];/gi, "")
    .replace(/\bItem\s*#?\s*\d+.*$/i, "")
    .replace(/\bQuantity\s+\d+(?:\.\d+)?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return isBadCostcoItemName(cleaned) ? "" : cleaned;
}

function isBadCostcoItemName(value) {
  if (!value) return false;
  if (/sign up|email reminders|connection online|costcogrocery|shop confidently/i.test(value)) return true;
  if (/customer service|return policy|limited time offers|view order|track my/i.test(value)) return true;
  return false;
}

function requiredString(value, message) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(amount);
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
