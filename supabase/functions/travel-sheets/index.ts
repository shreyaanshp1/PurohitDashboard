const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_TRAVEL_SHEET_NAMES = ["Trips", "Flights", "Certificates_Awards"];

const DEFAULT_HEADERS_BY_SHEET = {
  Trips: ["Trip", "Destination", "Start Date", "End Date", "Status", "Budget", "Notes"],
  Flights: ["Flight", "From", "To", "Depart Date", "Depart Time", "Airline", "Confirmation", "Status", "Notes"],
  Certificates_Awards: ["Program", "Account", "Certificate/Award", "Value", "Expiration Date", "Status", "Notes"]
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const route = getFunctionRoute(url.pathname);

    if (request.method === "GET" && route.length === 0) {
      return jsonResponse(await listTravelSheets(), 200);
    }

    if (request.method === "POST" && route.length === 2 && route[1] === "rows") {
      const payload = await request.json();
      return jsonResponse(await appendTravelSheetRow({ sheetName: decodeURIComponent(route[0]), values: payload.values || payload.row || {} }), 200);
    }

    return jsonResponse({ success: false, error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Travel sheets request failed.";
    console.error("[travel-sheets]", error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

async function listTravelSheets() {
  const spreadsheetId = getTravelSpreadsheetId();
  const sheetNames = getTravelSheetNames();
  const accessToken = await getGoogleAccessToken();
  const sheets = await Promise.all(sheetNames.map((sheetName) => readTravelSheet({ accessToken, spreadsheetId, sheetName })));

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    spreadsheetId,
    sheets
  };
}

async function appendTravelSheetRow({ sheetName, values }) {
  assertAllowedSheetName(sheetName);

  const spreadsheetId = getTravelSpreadsheetId();
  const accessToken = await getGoogleAccessToken();
  const sheet = await readTravelSheet({ accessToken, spreadsheetId, sheetName });
  const rowValues = buildRowValues(sheet.headers, values);
  const updatedRange = await appendRowToSheet({ accessToken, spreadsheetId, sheetName, values: rowValues });

  return {
    success: true,
    sheetName,
    row: Object.fromEntries(sheet.headers.map((header, index) => [header, rowValues[index] || ""])),
    updatedRange
  };
}

async function readTravelSheet({ accessToken, spreadsheetId, sheetName }) {
  assertAllowedSheetName(sheetName);

  const values = await getSheetValues({ accessToken, spreadsheetId, sheetName });
  return normalizeSheetValues(sheetName, values);
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

async function appendRowToSheet({ accessToken, spreadsheetId, sheetName, values }) {
  const range = encodeURIComponent(`${quoteSheetName(sheetName)}!A:ZZ`);
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [values] })
    }
  );
  const data = await parseGoogleResponse(response);

  return data.updates?.updatedRange || "";
}

function normalizeSheetValues(sheetName, values) {
  const rows = Array.isArray(values) ? values : [];
  const defaultHeaders = DEFAULT_HEADERS_BY_SHEET[sheetName] || [];
  const headerRow = rows[0] || [];
  const width = Math.max(headerRow.length, defaultHeaders.length, ...rows.map((row) => row.length), 1);
  const headers = makeUniqueHeaders(
    Array.from({ length: width }, (_, index) => cleanHeader(headerRow[index]) || defaultHeaders[index] || `Column ${index + 1}`)
  );
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));

  return {
    name: sheetName,
    headers,
    rows: dataRows.map((row, rowIndex) => {
      const normalizedRow = { id: `${sheetName}-${rowIndex + 2}` };

      headers.forEach((header, columnIndex) => {
        normalizedRow[header] = row[columnIndex] || "";
      });

      return normalizedRow;
    }),
    rowCount: dataRows.length
  };
}

function buildRowValues(headers, values) {
  if (Array.isArray(values)) return values;

  const rowValues = headers.map((header) => {
    const directValue = values?.[header];
    const normalizedValue = values?.[normalizeKey(header)];
    const value = directValue ?? normalizedValue ?? "";

    if (!value && /^logged\s+at$/i.test(header)) {
      return new Date().toISOString();
    }

    return value;
  });

  if (!rowValues.some((value) => String(value || "").trim())) {
    throw new Error("At least one travel row value is required.");
  }

  return rowValues;
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
      scope: GOOGLE_SHEETS_SCOPE
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

async function parseGoogleResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || data.error || `Google request failed with status ${response.status}.`);
  }

  return data;
}

function getTravelSpreadsheetId() {
  const spreadsheetId = Deno.env.get("TRAVEL_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Missing TRAVEL_SPREADSHEET_ID.");
  return spreadsheetId;
}

function getTravelSheetNames() {
  const configuredNames = Deno.env.get("TRAVEL_SHEET_NAMES");
  if (!configuredNames) return DEFAULT_TRAVEL_SHEET_NAMES;

  return configuredNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function assertAllowedSheetName(sheetName) {
  if (getTravelSheetNames().includes(sheetName)) return;

  throw new Error(`Unknown travel sheet: ${sheetName || "missing"}.`);
}

function getFunctionRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const functionIndex = parts.indexOf("travel-sheets");

  return functionIndex === -1 ? [] : parts.slice(functionIndex + 1);
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

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
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

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}
