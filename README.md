# Santosh Portfolio Command Center

A React dashboard prototype for tracking Costco, US Mint, Dell, commodities, buyers, rewards, alerts, and reports from one operational UI.

The first iteration keeps data local and structured so the UI can move quickly. Costco order records are shaped like Gmail parser output, while raw email bodies stay out of the repository.

## Run Locally

```sh
npm install
npm run dev
```

Then open the local Vite URL printed in the terminal.

`npm run dev` starts the private purchase API and the Vite app together. Purchase and receipt data is persisted through Supabase, not browser `localStorage`.

## Sign-In Credentials

The previous built-in demo fallback has been removed. For real access control, use Supabase-backed users. For private local testing only, create `.env.local` and set:

```sh
VITE_DEMO_USERNAME=your-private-username
VITE_DEMO_PASSWORD=your-long-private-password
VITE_DEMO_NAME=Local Admin
```

Restart `npm run dev` after changing `.env.local`.

Security note: Vite exposes `VITE_*` values to browser code. Do not rely on local demo credentials to protect a public deployment. Public deployments should use Supabase auth records and avoid enabling the local fallback.

## Useful Scripts

```sh
npm run dev
npm run build
npm run test:parser
```

## Purchase and Receipt Logging to Supabase

The dashboard includes a plus-triggered purchase logger on the Home page, a Receipts tab with retailer folders, a lightweight bottom-left toast system, and a private API.

Files:

- `src/components/PurchaseLogger.jsx`
- `src/components/ReceiptLogger.jsx`
- `src/components/ToastProvider.jsx`
- `src/services/purchaseLog.js`
- `server/purchaseLoggerServer.mjs`
- `server/supabaseClient.mjs`
- `supabase/schema.sql`
- `docs/costco-import-plan.md`
- `google-apps-script/purchaseLogger.gs`

Recommended private setup:

Use Supabase with the private Node API. See `docs/supabase-setup.md`.

The old Airtable setup is archived in `docs/airtable-setup.md`. The old Google Sheets setup is archived in `docs/google-sheets-setup.md`.

Security note: `VITE_*` values are bundled into browser code. Do not put Supabase service role keys, Google service-account JSON private keys, or any other private token in a Vite env var. Private writes should go through the Node API or another backend route.

## GitHub Pages and Master Data

GitHub Pages hosts the Vite frontend from `.github/workflows/deploy-pages.yml`. Because GitHub Pages is static hosting, private Google credentials still need to live in a backend. The travel master-data API is deployed as a Supabase Edge Function at `supabase/functions/travel-master-data`.

The deploy workflow copies `dist/index.html` to `dist/404.html` after every build. This lets GitHub Pages fall back to the React app when the site is refreshed on a nested URL instead of showing GitHub's 404 page.

Use the same Google service account email you use for transactional Google Sheets unless you specifically want separate access boundaries. Share the Travel Master Data spreadsheet with that service account email as `Viewer`. Keep `Editor` access only on sheets where the app needs to write.

Supabase Edge Function setup:

Full step-by-step setup: `docs/supabase-master-data-edge-function.md`.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'
supabase secrets set TRAVEL_MASTER_DATA_SPREADSHEET_ID=YOUR_MASTER_SHEET_ID
supabase secrets set TRAVEL_MASTER_DATA_HEADER_ROW=1
supabase functions deploy travel-master-data
```

Then add this GitHub repository variable under `Settings > Secrets and variables > Actions > Variables`:

```txt
VITE_TRAVEL_MASTER_DATA_ENDPOINT=https://YOUR_PROJECT_REF.supabase.co/functions/v1/travel-master-data
```

## Current Scope

- React/Vite frontend with left-sidebar navigation.
- Home command center with KPI cards, portfolio cards, alerts, pipeline status, and plus-triggered purchase logging.
- Costco dashboard with account cards, Gmail-sourced order rows, relationships, and renewal/reward planning.
- Gmail OAuth import for Costco order emails into Supabase.
- Receipts tab with retailer-folder filtering, local receipt file selection, receipt entry, and folder creation.
- Detail views for US Mint, Dell, commodities, buyers, rewards, alerts, reports, and settings.
- JavaScript parser test for Costco order confirmation email text.

## Next Iterations

- Promote more dashboard panels from static placeholders to Supabase-backed records.
- Expand the Gmail API importer to US Mint and Dell.
- Add Excel uploads for historical portfolio data.
- Promote static alert rules into a real alerts engine.
