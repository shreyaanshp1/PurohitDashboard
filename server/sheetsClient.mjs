import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SHEETS_WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = `https://${["oa", "uth2"].join("")}.googleapis.com/token`;
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_SERVICE_ACCOUNT_KEY_FILE = "secrets/google-sheet-api.json";

const cachedTokens = new Map();

export async function getSheetValues({ spreadsheetId, sheetName, range = "A:ZZ" }) {
  const accessToken = await getAccessToken(SHEETS_READONLY_SCOPE);
  const encodedRange = encodeURIComponent(`${quoteSheetName(sheetName)}!${range}`);
  const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodedRange}`, {
    headers: authHeaders(accessToken)
  });
  const data = await parseGoogleResponse(response);

  return data.values || [];
}

export async function appendRowToSheet({ spreadsheetId, sheetName, values, range = "A:ZZ" }) {
  const accessToken = await getAccessToken(SHEETS_WRITE_SCOPE);
  const encodedRange = encodeURIComponent(`${quoteSheetName(sheetName)}!${range}`);
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: authJsonHeaders(accessToken),
      body: JSON.stringify({ values: [values] })
    }
  );
  const data = await parseGoogleResponse(response);

  return {
    success: true,
    updatedRange: data.updates?.updatedRange
  };
}

export async function updateRowInSheet({ spreadsheetId, sheetName, rowNumber, values }) {
  const accessToken = await getAccessToken(SHEETS_WRITE_SCOPE);
  const safeRowNumber = Number.parseInt(rowNumber, 10);

  if (!Number.isFinite(safeRowNumber) || safeRowNumber < 2) {
    throw new Error("A valid spreadsheet row number is required.");
  }

  const lastColumn = columnName(values.length || 1);
  const encodedRange = encodeURIComponent(`${quoteSheetName(sheetName)}!A${safeRowNumber}:${lastColumn}${safeRowNumber}`);
  const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify({ values: [values] })
  });
  const data = await parseGoogleResponse(response);

  return {
    success: true,
    updatedRange: data.updatedRange
  };
}

async function getAccessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const cachedToken = cachedTokens.get(scope);

  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const credentials = getServiceAccountCredentials();
  const assertion = signJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: credentials.client_email,
      scope,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now
    },
    privateKey: credentials.private_key
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: ["urn:ietf:params:", ["oa", "uth"].join(""), ":grant-type:jwt-bearer"].join(""),
      assertion
    })
  });

  const data = await parseGoogleResponse(response);
  const token = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600)
  };
  cachedTokens.set(scope, token);

  return token.accessToken;
}

function getServiceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    const keyPath = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
    return normalizeCredentials(JSON.parse(fs.readFileSync(keyPath, "utf8")));
  }

  const defaultKeyPath = path.resolve(process.cwd(), DEFAULT_SERVICE_ACCOUNT_KEY_FILE);
  if (fs.existsSync(defaultKeyPath)) {
    return normalizeCredentials(JSON.parse(fs.readFileSync(defaultKeyPath, "utf8")));
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return normalizeCredentials(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON));
  }

  return normalizeCredentials({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
  });
}

function normalizeCredentials(credentials) {
  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key?.replace(/\\n/g, "\n");

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

function signJwt({ header, payload, privateKey }) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey);

  return `${signingInput}.${base64url(signature)}`;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function columnName(index) {
  let value = Math.max(Number(index) || 1, 1);
  let name = "";

  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }

  return name;
}

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function authJsonHeaders(accessToken) {
  return {
    ...authHeaders(accessToken),
    "Content-Type": "application/json"
  };
}

async function parseGoogleResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || `Google API request failed with status ${response.status}.`);
  }

  return data;
}
