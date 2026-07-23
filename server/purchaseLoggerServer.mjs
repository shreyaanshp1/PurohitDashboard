import http from "node:http";
import {
  authenticateDashboardPassword
} from "./authService.mjs";
import {
  appendReceiptToSupabase,
  createReceiptFolderInSupabase,
  listReceiptFoldersFromSupabase,
  listReceiptsFromSupabase
} from "./supabaseClient.mjs";
import { appendPurchase, listRecentPurchases } from "./purchaseStore.mjs";
import { readReceiptFile, saveReceiptFile } from "./receiptFiles.mjs";
import { loadEnvFiles } from "./serverEnv.mjs";
import { appendSpreadsheetSourceRow, listSpreadsheetSource, updateSpreadsheetSourceRow } from "./spreadsheetSources.mjs";

loadEnvFiles();

const HOST = "127.0.0.1";
const PORT = Number(process.env.PURCHASE_LOG_SERVER_PORT || 8787);
const ALLOWED_ORIGINS = new Set(
  (process.env.PURCHASE_LOG_ALLOWED_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || "";

  if (request.method === "OPTIONS") {
    sendOptions(response, origin);
    return;
  }

  if (request.url === "/health") {
    sendJson(response, 200, { success: true, service: "purchase-log-api" }, origin);
    return;
  }

  const url = new URL(request.url, "http://127.0.0.1");

  if (!url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { success: false, error: "Not found." }, origin);
    return;
  }

  if (!isAllowedOrigin(origin)) {
    sendJson(response, 403, { success: false, error: "Origin is not allowed." }, origin);
    return;
  }

  try {
    if (url.pathname.startsWith("/api/receipt-files/") && request.method === "GET") {
      const storedName = decodeURIComponent(url.pathname.replace("/api/receipt-files/", ""));
      const file = await readReceiptFile(storedName);
      sendBinary(response, 200, file, origin);
      return;
    }

    const result = await routeApiRequest(request, url);
    sendJson(response, 200, result, origin);
  } catch (error) {
    console.error("[purchase-log-api]", error);
    sendJson(response, error.statusCode || 500, { success: false, error: error.message }, origin);
  }
});

server.on("error", async (error) => {
  if (error.code !== "EADDRINUSE") {
    console.error("[purchase-log-api]", error);
    process.exit(1);
  }

  const runningService = await readRunningServiceHealth();
  if (runningService?.service === "purchase-log-api") {
    console.log(`Purchase log API is already running at http://${HOST}:${PORT}`);
    process.exit(0);
  }

  console.error(
    `Port ${PORT} is already in use. Stop the process using http://${HOST}:${PORT}, or set PURCHASE_LOG_SERVER_PORT to a free port.`
  );
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Purchase log API listening at http://${HOST}:${PORT}`);
});

async function readRunningServiceHealth() {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/health`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function routeApiRequest(request, url) {
  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return authenticateDashboardPassword(payload);
  }

  if (url.pathname === "/api/auth/signin" && request.method === "POST") {
    throw routeDisabledError("Username login is disabled.");
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    throw routeDisabledError("Signup is disabled.");
  }

  if (url.pathname === "/api/auth/password-reset/request" && request.method === "POST") {
    throw routeDisabledError("Password reset is disabled.");
  }

  if (url.pathname === "/api/auth/password-reset/confirm" && request.method === "POST") {
    throw routeDisabledError("Password reset is disabled.");
  }

  if (url.pathname === "/api/purchases") {
    if (request.method === "GET") {
      return listRecentPurchases(url.searchParams.get("limit"));
    }

    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      return appendPurchase(payload.purchase || payload);
    }
  }

  if (url.pathname === "/api/receipt-folders") {
    if (request.method === "GET") {
      return listReceiptFoldersFromSupabase();
    }

    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      return createReceiptFolderInSupabase(payload.folder || payload);
    }
  }

  if (url.pathname === "/api/receipts") {
    if (request.method === "GET") {
      return listReceiptsFromSupabase({
        limit: url.searchParams.get("limit"),
        retailer: url.searchParams.get("retailer")
      });
    }

    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      return appendReceiptToSupabase(payload.receipt || payload);
    }
  }

  if (url.pathname === "/api/receipt-files" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return saveReceiptFile(payload.file || payload);
  }

  const spreadsheetSourceMatch = url.pathname.match(/^\/api\/spreadsheets\/([^/]+)$/);
  if (spreadsheetSourceMatch && request.method === "GET") {
    return listSpreadsheetSource(decodeURIComponent(spreadsheetSourceMatch[1]));
  }

  const spreadsheetAppendMatch = url.pathname.match(/^\/api\/spreadsheets\/([^/]+)\/([^/]+)\/rows$/);
  if (spreadsheetAppendMatch && request.method === "POST") {
    const payload = await readJsonBody(request);
    return appendSpreadsheetSourceRow({
      sourceId: decodeURIComponent(spreadsheetAppendMatch[1]),
      sheetName: decodeURIComponent(spreadsheetAppendMatch[2]),
      values: payload.values || payload.row || {}
    });
  }

  const spreadsheetUpdateMatch = url.pathname.match(/^\/api\/spreadsheets\/([^/]+)\/([^/]+)\/rows\/([^/]+)$/);
  if (spreadsheetUpdateMatch && request.method === "PATCH") {
    const payload = await readJsonBody(request);
    return updateSpreadsheetSourceRow({
      sourceId: decodeURIComponent(spreadsheetUpdateMatch[1]),
      sheetName: decodeURIComponent(spreadsheetUpdateMatch[2]),
      rowNumber: decodeURIComponent(spreadsheetUpdateMatch[3]),
      values: payload.values || payload.row || {}
    });
  }

  const knownPath = [
    "/api/purchases",
    "/api/auth/password",
    "/api/auth/signin",
    "/api/auth/signup",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset/confirm",
    "/api/receipt-folders",
    "/api/receipts",
    "/api/receipt-files"
  ].includes(url.pathname) || url.pathname.startsWith("/api/spreadsheets/");
  const error = new Error(knownPath ? "Method not allowed." : "Not found.");
  error.statusCode = knownPath ? 405 : 404;
  throw error;
}

function routeDisabledError(message) {
  const error = new Error(message);
  error.statusCode = 410;
  return error;
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function sendOptions(response, origin) {
  response.writeHead(isAllowedOrigin(origin) ? 204 : 403, corsHeaders(origin));
  response.end();
}

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    ...corsHeaders(origin),
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

function sendBinary(response, status, file, origin) {
  response.writeHead(status, {
    ...corsHeaders(origin),
    "Cache-Control": "private, max-age=300",
    "Content-Length": file.buffer.length,
    "Content-Type": file.contentType
  });
  response.end(file.buffer);
}

function corsHeaders(origin) {
  if (!isAllowedOrigin(origin) || !origin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
