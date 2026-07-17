const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const DEFAULT_MASTER_DATA_HEADER_ROW = 1;
const DEFAULT_MASTER_DATA_SHEET_NAMES = [
  "Travelers",
  "Hotel_Properties",
  "Hotel_Brands",
  "Airports",
  "National_Park_States",
  "Cities",
  "Currencies",
  "Airlines",
  "Credit_Cards",
  "National Parks",
  "Traveler_Loyalty_Accounts",
  "States_Provinces",
  "Rental_Car_Companies",
  "Expense_Categories",
  "Hotel_Chains",
  "Loyalty_Programs",
  "Place_Types",
  "Countries"
];

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const result = await listTravelMasterData();
    return jsonResponse(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Travel master data request failed.";
    console.error("[travel-master-data]", error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

async function listTravelMasterData() {
  const spreadsheetId = getMasterDataSpreadsheetId();
  const headerRowNumber = getMasterDataHeaderRowNumber();
  const sheetNames = getMasterDataSheetNames();
  const accessToken = await getGoogleAccessToken();
  const sheets = await Promise.all(
    sheetNames.map((sheetName) => readMasterDataSheet({ accessToken, spreadsheetId, sheetName, headerRowNumber }))
  );

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    readOnly: true,
    spreadsheetId,
    headerRowNumber,
    sheets
  };
}

async function readMasterDataSheet({ accessToken, spreadsheetId, sheetName, headerRowNumber }) {
  assertAllowedMasterDataSheetName(sheetName);

  const values = await getSheetValues({ accessToken, spreadsheetId, sheetName });
  return normalizeMasterDataValues({ sheetName, values, headerRowNumber });
}

async function getSheetValues({ accessToken, spreadsheetId, sheetName }) {
  const range = encodeURIComponent(`${quoteSheetName(sheetName)}!A:ZZ`);
  const response = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await parseGoogleResponse(response);

  return data.values || [];
}

function normalizeMasterDataValues({ sheetName, values, headerRowNumber }) {
  const rows = Array.isArray(values) ? values : [];
  const headerRowIndex = Math.max(headerRowNumber - 1, 0);
  const headerRow = rows[headerRowIndex] || [];
  const width = Math.max(headerRow.length, ...rows.map((row) => row.length), 1);
  const headers = makeUniqueHeaders(
    Array.from({ length: width }, (_, index) => cleanHeader(headerRow[index]) || `Column ${index + 1}`)
  );
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell || "").trim()));

  return {
    name: sheetName,
    readOnly: true,
    headerRowNumber,
    headers,
    rows: dataRows.map((row, rowIndex) => {
      const normalizedRow = { id: `${sheetName}-${headerRowIndex + rowIndex + 2}` };

      headers.forEach((header, columnIndex) => {
        normalizedRow[header] = row[columnIndex] || "";
      });

      return normalizedRow;
    }),
    rowCount: dataRows.length
  };
}

async function getGoogleAccessToken() {
  const credentials = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    header: {
      alg: "RS256",
      typ: "JWT"
    },
    payload: {
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
      iss: credentials.client_email,
      scope: GOOGLE_SHEETS_READONLY_SCOPE
    },
    privateKey: credentials.private_key
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    })
  });
  const data = await parseGoogleResponse(response);

  return data.access_token;
}

function getServiceAccountCredentials() {
  const rawJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (rawJson) {
    return normalizeCredentials(JSON.parse(rawJson));
  }

  return normalizeCredentials({
    client_email: Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    private_key: Deno.env.get("GOOGLE_PRIVATE_KEY")
  });
}

function normalizeCredentials(credentials) {
  const clientEmail = credentials.client_email || "";
  const privateKey = credentials.private_key?.replace(/\\n/g, "\n") || "";

  if (!clientEmail) {
    throw new Error("Missing service-account client email.");
  }

  if (!privateKey) {
    throw new Error("Missing service-account private key.");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey
  };
}

async function signJwt({ header, payload, privateKey }) {
  const encodedHeader = base64urlString(JSON.stringify(header));
  const encodedPayload = base64urlString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64urlBytes(signature)}`;
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function base64urlString(value) {
  return base64urlBytes(new TextEncoder().encode(value));
}

function base64urlBytes(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function parseGoogleResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || data.error || `Google request failed with status ${response.status}.`);
  }

  return data;
}

function getMasterDataSpreadsheetId() {
  const spreadsheetId = Deno.env.get("TRAVEL_MASTER_DATA_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Missing TRAVEL_MASTER_DATA_SPREADSHEET_ID.");
  return spreadsheetId;
}

function getMasterDataHeaderRowNumber() {
  const headerRowNumber = Number.parseInt(String(Deno.env.get("TRAVEL_MASTER_DATA_HEADER_ROW") || DEFAULT_MASTER_DATA_HEADER_ROW), 10);
  return Number.isFinite(headerRowNumber) && headerRowNumber > 0 ? headerRowNumber : DEFAULT_MASTER_DATA_HEADER_ROW;
}

function getMasterDataSheetNames() {
  const configuredNames = Deno.env.get("TRAVEL_MASTER_DATA_SHEET_NAMES");
  if (!configuredNames) return DEFAULT_MASTER_DATA_SHEET_NAMES;

  return configuredNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function assertAllowedMasterDataSheetName(sheetName) {
  if (getMasterDataSheetNames().includes(sheetName)) return;

  throw new Error(`Unknown travel master data sheet: ${sheetName || "missing"}.`);
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

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}
