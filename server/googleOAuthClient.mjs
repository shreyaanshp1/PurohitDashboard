import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export function hasGoogleOAuthConfig() {
  return Boolean(googleOAuthConfig().clientId && googleOAuthConfig().clientSecret);
}

export async function getGoogleOAuthStatus() {
  const token = await readStoredToken();

  return {
    success: true,
    configured: hasGoogleOAuthConfig(),
    authenticated: Boolean(token?.refresh_token || token?.access_token),
    expiresAt: token?.expires_at || null
  };
}

export function getGoogleAuthUrl() {
  const { clientId, redirectUri } = requiredGoogleOAuthConfig();
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_READONLY_SCOPE
  });

  return {
    success: true,
    authUrl: `${GOOGLE_AUTH_URL}?${params}`
  };
}

export async function exchangeGoogleOAuthCode(code) {
  if (!code) throw new Error("Missing Google OAuth code.");

  const { clientId, clientSecret, redirectUri } = requiredGoogleOAuthConfig();
  const token = await requestGoogleToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });

  await writeStoredToken(token);

  return {
    success: true,
    authenticated: true
  };
}

export async function listGmailMessages({ query, limit = 25 }) {
  const accessToken = await getGmailAccessToken();
  const maxResults = Math.min(Math.max(Number(limit) || 25, 1), 10000);
  const messages = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      maxResults: String(Math.min(maxResults - messages.length, 500)),
      q: query
    });

    if (pageToken) params.set("pageToken", pageToken);

    const data = await gmailRequest(`/users/me/messages?${params}`, accessToken);
    messages.push(...(data.messages || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken && messages.length < maxResults);

  return messages.slice(0, maxResults);
}

export async function getGmailMessageText(messageId) {
  const accessToken = await getGmailAccessToken();
  const message = await gmailRequest(`/users/me/messages/${encodeURIComponent(messageId)}?format=full`, accessToken);
  const headers = message.payload?.headers || [];
  const recipient = headerValue(headers, "To") || headerValue(headers, "Delivered-To") || "";
  const sender = headerValue(headers, "From") || "";
  const subject = headerValue(headers, "Subject") || "";
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : "";
  const body = extractPlainText(message.payload) || extractHtmlText(message.payload) || message.snippet || "";

  return {
    id: message.id,
    threadId: message.threadId,
    recipient,
    sender,
    subject,
    receivedAt,
    body
  };
}

async function getGmailAccessToken() {
  const token = await readStoredToken();

  if (!token) {
    throw new Error("Google OAuth is not connected.");
  }

  if (token.access_token && token.expires_at && Date.now() < token.expires_at - TOKEN_EXPIRY_BUFFER_MS) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error("Google OAuth refresh token is missing. Reconnect Gmail.");
  }

  const { clientId, clientSecret } = requiredGoogleOAuthConfig();
  const refreshed = await requestGoogleToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  const nextToken = {
    ...token,
    ...refreshed,
    refresh_token: refreshed.refresh_token || token.refresh_token
  };

  await writeStoredToken(nextToken);

  return nextToken.access_token;
}

async function requestGoogleToken(payload) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Google OAuth failed with status ${response.status}.`);
  }

  return {
    ...data,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null
  };
}

async function gmailRequest(pathname, accessToken) {
  const response = await fetch(`${GMAIL_API_BASE}${pathname}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Gmail request failed with status ${response.status}.`);
  }

  return data;
}

function googleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://127.0.0.1:8787/api/google/oauth/callback"
  };
}

function requiredGoogleOAuthConfig() {
  const config = googleOAuthConfig();

  if (!config.clientId) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID.");
  if (!config.clientSecret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET.");

  return config;
}

async function readStoredToken() {
  try {
    const text = await readFile(tokenFilePath(), "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeStoredToken(token) {
  const filePath = tokenFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
}

function tokenFilePath() {
  const configured = process.env.GOOGLE_OAUTH_TOKEN_FILE || "secrets/google-oauth-token.json";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function headerValue(headers, name) {
  const header = headers.find((current) => current.name.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function extractPlainText(part) {
  if (!part) return "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  for (const child of part.parts || []) {
    const text = extractPlainText(child);
    if (text) return text;
  }

  if (part.body?.data && part.mimeType !== "text/html") {
    return decodeBase64Url(part.body.data);
  }

  return "";
}

function extractHtmlText(part) {
  if (!part) return "";

  if (part.mimeType === "text/html" && part.body?.data) {
    return htmlToText(decodeBase64Url(part.body.data));
  }

  for (const child of part.parts || []) {
    const text = extractHtmlText(child);
    if (text) return text;
  }

  return "";
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|table|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#36;/g, "$")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
