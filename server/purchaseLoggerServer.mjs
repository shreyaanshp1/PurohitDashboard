import http from "node:http";
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

loadEnvFiles();

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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Purchase log API listening at http://127.0.0.1:${PORT}`);
});

async function routeApiRequest(request, url) {
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
    return getGoogleAuthUrl();
  }

  if (url.pathname === "/api/google/oauth/callback" && request.method === "GET") {
    return exchangeGoogleOAuthCode(url.searchParams.get("code"));
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

  if (url.pathname.startsWith("/api/travel/sheets/") && url.pathname.endsWith("/rows")) {
    if (request.method === "POST") {
      const sheetName = decodeURIComponent(url.pathname.slice("/api/travel/sheets/".length, -"/rows".length));
      const payload = await readJsonBody(request);
      return appendTravelSheetRow({ sheetName, values: payload.values || payload.row || {} });
    }
  }

  const knownPath = [
    "/api/purchases",
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
  ].includes(url.pathname) || url.pathname.startsWith("/api/travel/sheets/");
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
