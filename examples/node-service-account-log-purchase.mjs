import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const PURCHASE_HEADER = [
  "Date",
  "Store Name",
  "Total Amount",
  "Category",
  "Items/Notes",
  "Rewards Earned",
  "Logged At"
];

export async function appendPurchaseWithServiceAccount(purchase) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Purchases";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID.");
  }

  const sheets = google.sheets({
    version: "v4",
    auth: new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: getPrivateKey(),
      scopes: SCOPES
    })
  });

  await ensureHeader({ sheets, spreadsheetId, sheetName });

  const row = [
    purchase.date || new Date().toISOString().slice(0, 10),
    purchase.storeName,
    Number(purchase.totalAmount),
    purchase.category,
    purchase.itemsNotes || "",
    Number(purchase.rewardsEarned || 0),
    new Date().toISOString()
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });

  return {
    success: true,
    updatedRange: response.data.updates?.updatedRange
  };
}

export async function logPurchaseRequestHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed." });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const result = await appendPurchaseWithServiceAccount(payload.purchase || payload);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function ensureHeader({ sheets, spreadsheetId, sheetName }) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:G1`
  });

  if (response.data.values?.[0]?.some(Boolean)) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:G1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [PURCHASE_HEADER]
    }
  });
}

function getPrivateKey() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing GOOGLE_PRIVATE_KEY.");
  }

  return privateKey.replace(/\\n/g, "\n");
}
