import { parseCostcoOrderEmail } from "../src/services/costcoEmailParser.js";
import { COSTCO_ORDER_GMAIL_QUERY } from "../src/services/costcoGmailQuery.js";
import { buildGmailQueryBatches } from "./gmailImportBatches.mjs";
import { getGmailMessageText, listGmailMessages } from "./googleOAuthClient.mjs";
import {
  clearCostcoOrdersFromSupabase,
  listCostcoOrdersFromSupabase,
  upsertCostcoOrderToSupabase
} from "./supabaseClient.mjs";

export const DEFAULT_COSTCO_GMAIL_QUERY =
  COSTCO_ORDER_GMAIL_QUERY;

export async function listCostcoOrders(limit = 500) {
  return listCostcoOrdersFromSupabase(limit);
}

export async function clearCostcoOrders() {
  return clearCostcoOrdersFromSupabase();
}

export async function importCostcoOrders({
  query = process.env.COSTCO_GMAIL_QUERY || DEFAULT_COSTCO_GMAIL_QUERY,
  limit = process.env.COSTCO_GMAIL_IMPORT_LIMIT || 500,
  limitPerBatch = "",
  historyStartYear = "",
  historyEndYear = "",
  listMessages = listGmailMessages,
  getMessageText = getGmailMessageText,
  upsertOrder = upsertCostcoOrderToSupabase
} = {}) {
  const maxMessages = Math.min(Math.max(Number(limit) || 500, 1), 10000);
  const queryBatches = buildGmailQueryBatches({ query, historyStartYear, historyEndYear });
  const batchLimit = Math.min(
    Math.max(Number(limitPerBatch) || (historyStartYear ? 1000 : maxMessages), 1),
    10000
  );
  const seenMessageIds = new Set();
  const imported = [];
  const skipped = [];
  const batches = [];

  for (const batch of queryBatches) {
    if (seenMessageIds.size >= maxMessages) break;

    const messages = await listMessages({
      query: batch.query,
      limit: Math.min(batchLimit, maxMessages - seenMessageIds.size)
    });
    const batchStats = { label: batch.label, query: batch.query, scanned: 0, imported: 0, skipped: 0 };

    for (const message of messages) {
      if (seenMessageIds.has(message.id)) continue;
      seenMessageIds.add(message.id);
      batchStats.scanned += 1;

      try {
        const email = await getMessageText(message.id);
        const record = parseCostcoOrderEmail({
          body: email.body,
          messageId: email.id,
          receivedAt: email.receivedAt,
          recipient: email.recipient,
          subject: email.subject,
          redactIdentifiers: false
        });

        if (!isUsefulCostcoOrder(record)) {
          skipped.push({ messageId: message.id, reason: "No Costco order fields found.", batch: batch.label });
          batchStats.skipped += 1;
          continue;
        }

        const result = await upsertOrder(record);
        imported.push(result.order);
        batchStats.imported += 1;
      } catch (error) {
        if (isCostcoSchemaError(error)) {
          throw new Error(`Costco orders table needs the latest schema before import. Run supabase/schema.sql, then import again. Supabase said: ${error.message}`);
        }

        skipped.push({ messageId: message.id, reason: error.message, batch: batch.label });
        batchStats.skipped += 1;
      }
    }

    batches.push(batchStats);
  }

  return {
    success: true,
    scanned: batches.reduce((total, batch) => total + batch.scanned, 0),
    imported: imported.length,
    skipped: skipped.length,
    query,
    batches,
    orders: imported,
    skippedMessages: skipped
  };
}

function isUsefulCostcoOrder(record) {
  return Boolean(record.sourceMessageId && (record.orderNumberLast4 || record.itemName || record.total));
}

function isCostcoSchemaError(error) {
  return /column .* does not exist|could not find .* column|schema cache/i.test(error.message || "");
}
