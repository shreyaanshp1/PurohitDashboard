import http from "node:http";
import {
  confirmAuthPasswordReset,
  registerAuthUser,
  requestAuthPasswordReset,
  signInAuthUser
} from "./authService.mjs";
import { clearCostcoOrders, importCostcoOrders, listCostcoOrders } from "./costcoOrderImporter.mjs";
import { exchangeGoogleOAuthCode, getGoogleAuthUrl, getGoogleOAuthStatus } from "./googleOAuthClient.mjs";
import { clearUsMintOrders, importUsMintOrders, listUsMintOrders } from "./usMintOrderImporter.mjs";
import { listTravelMasterData } from "./travelMasterData.mjs";
import { appendTravelSheetRow, listTravelSheets } from "./travelSheets.mjs";
import {
  appendReceiptToSupabase,
  createReceiptFolderInSupabase,
  listReceiptFoldersFromSupabase,
  listReceiptsFromSupabase
} from "./supabaseClient.mjs";
import { appendPurchase, listRecentPurchases } from "./purchaseStore.mjs";
import { readReceiptFile, saveReceiptFile } from "./receiptFiles.mjs";
import { loadEnvFiles } from "./serverEnv.mjs";
import { appendSpreadsheetSourceRow, listSpreadsheetSource } from "./spreadsheetSources.mjs";

loadEnvFiles();

const HOST = "127.0.0.1";
const PORT = Number(process.env.PURCHASE_LOG_SERVER_PORT || 8787);
const GOOGLE_OAUTH_MESSAGE_TYPE = "google-oauth-complete";
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
  if (url.pathname === "/api/auth/signin" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return signInAuthUser(payload);
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return registerAuthUser(payload);
  }

  if (url.pathname === "/api/auth/password-reset/request" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return requestAuthPasswordReset(payload);
  }

  if (url.pathname === "/api/auth/password-reset/confirm" && request.method === "POST") {
    const payload = await readJsonBody(request);
    return confirmAuthPasswordReset(payload);
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

  if (url.pathname === "/api/google/oauth/status" && request.method === "GET") {
    return getGoogleOAuthStatus();
  }

  if (url.pathname === "/api/google/oauth/url" && request.method === "GET") {
    return getGoogleAuthUrl({
      state: encodeGoogleOAuthState({
        returnUrl: allowedReturnUrl(url.searchParams.get("returnUrl"))
      })
    });
  }

  if (url.pathname === "/api/google/oauth/callback" && request.method === "GET") {
    const state = decodeGoogleOAuthState(url.searchParams.get("state"));
    const returnUrl = allowedReturnUrl(state.returnUrl);

    if (url.searchParams.get("error")) {
      return htmlResponse(
        googleOAuthCallbackPage({
          error: url.searchParams.get("error_description") || url.searchParams.get("error"),
          returnUrl,
          success: false
        }),
        400
      );
    }

    try {
      await exchangeGoogleOAuthCode(url.searchParams.get("code"));
      return htmlResponse(googleOAuthCallbackPage({ returnUrl, success: true }));
    } catch (error) {
      return htmlResponse(googleOAuthCallbackPage({ error: error.message, returnUrl, success: false }), 400);
    }
  }

  if (url.pathname === "/api/costco-orders") {
    if (request.method === "GET") {
      return listCostcoOrders(url.searchParams.get("limit"));
    }
  }

  if (url.pathname === "/api/costco-orders/import") {
    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      return importCostcoOrders(payload);
    }
  }

  if (url.pathname === "/api/costco-orders/clear") {
    if (request.method === "POST") {
      return clearCostcoOrders();
    }
  }

  if (url.pathname === "/api/us-mint-orders") {
    if (request.method === "GET") {
      return listUsMintOrders(url.searchParams.get("limit"));
    }
  }

  if (url.pathname === "/api/us-mint-orders/import") {
    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      return importUsMintOrders(payload);
    }
  }

  if (url.pathname === "/api/us-mint-orders/clear") {
    if (request.method === "POST") {
      return clearUsMintOrders();
    }
  }

  if (url.pathname === "/api/travel/sheets") {
    if (request.method === "GET") {
      return listTravelSheets();
    }
  }

  if (url.pathname === "/api/travel/master-data") {
    if (request.method === "GET") {
      return listTravelMasterData();
    }
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

  if (url.pathname.startsWith("/api/travel/sheets/") && url.pathname.endsWith("/rows")) {
    if (request.method === "POST") {
      const sheetName = decodeURIComponent(url.pathname.slice("/api/travel/sheets/".length, -"/rows".length));
      const payload = await readJsonBody(request);
      return appendTravelSheetRow({ sheetName, values: payload.values || payload.row || {} });
    }
  }

  const knownPath = [
    "/api/purchases",
    "/api/auth/signin",
    "/api/auth/signup",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset/confirm",
    "/api/receipt-folders",
    "/api/receipts",
    "/api/receipt-files",
    "/api/google/oauth/status",
    "/api/google/oauth/url",
    "/api/google/oauth/callback",
    "/api/costco-orders",
    "/api/costco-orders/import",
    "/api/costco-orders/clear",
    "/api/us-mint-orders",
    "/api/us-mint-orders/import",
    "/api/us-mint-orders/clear",
    "/api/travel/sheets",
    "/api/travel/master-data"
  ].includes(url.pathname) || url.pathname.startsWith("/api/travel/sheets/") || url.pathname.startsWith("/api/spreadsheets/");
  const error = new Error(knownPath ? "Method not allowed." : "Not found.");
  error.statusCode = knownPath ? 405 : 404;
  throw error;
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function sendOptions(response, origin) {
  response.writeHead(isAllowedOrigin(origin) ? 204 : 403, corsHeaders(origin));
  response.end();
}

function sendJson(response, status, payload, origin) {
  if (payload?.responseType === "html") {
    sendHtml(response, payload.statusCode || status, payload.html, origin);
    return;
  }

  response.writeHead(status, {
    ...corsHeaders(origin),
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, status, html, origin) {
  response.writeHead(status, {
    ...corsHeaders(origin),
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(html);
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function htmlResponse(html, statusCode = 200) {
  return { html, responseType: "html", statusCode };
}

function encodeGoogleOAuthState(state) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeGoogleOAuthState(value) {
  if (!value) return {};

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function allowedReturnUrl(value) {
  if (!value) return "";

  try {
    const parsed = new URL(value);
    return isAllowedOrigin(parsed.origin) ? parsed.href : "";
  } catch {
    return "";
  }
}

function googleOAuthCallbackPage({ error = "", returnUrl = "", success }) {
  const title = success ? "Gmail connected" : "Google OAuth failed";
  const message = success
    ? "Gmail is connected. This tab can close now."
    : error || "Google OAuth did not complete.";
  const payload = {
    error,
    success,
    type: GOOGLE_OAUTH_MESSAGE_TYPE
  };
  const targetOrigin = returnUrl ? new URL(returnUrl).origin : "*";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        align-items: center;
        background: #f8fafc;
        color: #172033;
        display: flex;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
      }

      main {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
        max-width: 420px;
        padding: 28px;
      }

      h1 {
        font-size: 22px;
        line-height: 1.2;
        margin: 0 0 10px;
      }

      p {
        color: #475569;
        font-size: 15px;
        line-height: 1.5;
        margin: 0;
      }

      a {
        color: #2563eb;
        display: inline-block;
        font-weight: 700;
        margin-top: 18px;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${returnUrl ? `<a href="${escapeHtml(returnUrl)}">Return to dashboard</a>` : ""}
    </main>
    <script>
      (function () {
        var payload = ${JSON.stringify(payload)};
        var targetOrigin = ${JSON.stringify(targetOrigin)};

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);
            window.setTimeout(function () {
              window.close();
            }, 700);
          }
        } catch (error) {}
      })();
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
