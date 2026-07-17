# Costco Order Import Plan

## Decision

Use a repo-owned Node importer, not a hosted chat agent, as the long-running Costco order import path.

The importer should:

1. Search Gmail with the Gmail API for Costco order and shipment emails.
2. Parse each email with deterministic code in `src/services/costcoEmailParser.js`.
3. Upsert normalized order records into Supabase.
4. Keep raw email bodies out of Supabase unless a later debugging mode explicitly stores redacted samples.

This keeps the pipeline free of per-run LLM costs and avoids depending on a chat product staying free. ChatGPT, Gemini, or another model can still help during development or as an optional fallback parser for emails the deterministic parser cannot handle.

## Why Gmail First

Gmail is the most stable source for historical Costco order confirmations, shipment updates, renewals, and reward-related emails. It also avoids login automation against Costco, which can break on MFA, CAPTCHA, password changes, or website redesigns.

Scraping Costco should be a fallback only when Gmail is missing critical fields. If scraping is needed, run it locally with an authenticated browser session and write through the same Supabase API.

## Implemented Flow

1. Store imported records in `public.costco_orders`.
2. Use private API routes:
   - `GET /api/costco-orders`
   - `POST /api/costco-orders/import`
3. Authenticate Gmail once with OAuth and store the refresh token outside frontend code.
4. Search messages from Costco order-status senders, fetch plain-text bodies, parse, and upsert by Gmail message ID.
5. Surface imported rows in the Costco dashboard.

## Suggested Gmail Query

Use the order-status sender whitelist. This keeps marketing mail out while preserving confirmations, shipped/delivered updates, cancellations, refunds, and e-delivery codes:

```text
{from:orderstatus@costco.com from:Costco@orders.costco.com from:order-refund@costco.com from:order-cancel@costco.com from:Costco.com@memberedelivery.com} in:anywhere
```

## Data to Store

- Gmail message ID
- Received timestamp
- Account email
- Order number, redacted display value, and last 4
- Order date
- Membership number, redacted display value, and last 4
- Item name
- Item number
- Quantity
- Unit price
- Total
- Status
- Next action

## Guardrails

- Do not store Gmail OAuth secrets in `VITE_*` variables.
- Do not store raw email bodies by default.
- Upsert records so repeated imports are safe.
- Keep scraping behind an explicit manual command.
