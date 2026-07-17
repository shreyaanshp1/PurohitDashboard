import { parseUsMintOrderEmail } from "../src/services/usMintEmailParser.js";
import { US_MINT_CONFIRMED_ORDER_GMAIL_QUERY } from "../src/services/usMintGmailQuery.js";
import { buildGmailQueryBatches } from "./gmailImportBatches.mjs";
import { getGmailMessageText, listGmailMessages } from "./googleOAuthClient.mjs";
import {
  clearUsMintOrdersFromSupabase,
  listUsMintOrdersFromSupabase,
  upsertUsMintOrderToSupabase
} from "./supabaseClient.mjs";

export const DEFAULT_US_MINT_GMAIL_QUERY = US_MINT_CONFIRMED_ORDER_GMAIL_QUERY;

export async function listUsMintOrders(limit = 500) {
  return listUsMintOrdersFromSupabase(limit);
}

export async function clearUsMintOrders() {
  return clearUsMintOrdersFromSupabase();
}

export async function importUsMintOrders({
  query = process.env.US_MINT_GMAIL_QUERY || DEFAULT_US_MINT_GMAIL_QUERY,
  limit = process.env.US_MINT_GMAIL_IMPORT_LIMIT || 500,
  limitPerBatch = "",
  historyStartYear = "",
  historyEndYear = "",
  listMessages = listGmailMessages,
  getMessageText = getGmailMessageText,
  upsertOrder = upsertUsMintOrderToSupabase
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
        const record = parseUsMintOrderEmail({
          body: email.body,
          messageId: email.id,
          receivedAt: email.receivedAt,
          recipient: email.recipient,
          subject: email.subject
        });

        if (!isUsefulUsMintOrder(record)) {
          skipped.push({ messageId: message.id, reason: "No US Mint order fields found.", batch: batch.label });
          batchStats.skipped += 1;
          continue;
        }

        const result = await upsertOrder(record);
        imported.push(result.order);
        batchStats.imported += 1;
      } catch (error) {
        if (isUsMintSchemaError(error)) {
          throw new Error(
            `US Mint orders table needs the latest schema before import. Run supabase/schema.sql, then import again. Supabase said: ${error.message}`
          );
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

function isUsefulUsMintOrder(record) {
  return Boolean(record.sourceMessageId && (record.orderNumber || record.itemName || record.total));
}

function isUsMintSchemaError(error) {
  return /column .* does not exist|could not find .* column|schema cache|relation .* does not exist/i.test(error.message || "");
}
