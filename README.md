# Santosh Portfolio Command Center

A React dashboard prototype for tracking Costco, US Mint, Dell, commodities, buyers, rewards, alerts, and reports from one operational UI.

The dashboard keeps secondary sections local and structured so the UI can move quickly. Costco account, transaction, reward, and category rows come from one Google Sheets workbook.

## Run Locally

```sh
npm install
npm run dev
```

Then open the local Vite URL printed in the terminal.

`npm run dev` starts the private purchase API and the Vite app together. Purchase and receipt data is persisted through Supabase, not browser `localStorage`.

## Dashboard Password

The username/password and sign-up screens are disabled. The dashboard unlocks with one server-side admin password.

For private local testing, create `.env.local` and set:

```sh
ADMIN_DASHBOARD_PASSWORD=your-long-private-password
ADMIN_DASHBOARD_NAME=Dashboard Admin
```

Restart `npm run dev` after changing `.env.local`.

Security note: Vite exposes `VITE_*` values to browser code. Keep the dashboard password in non-`VITE` backend variables only. For GitHub Pages, store the same value as a Supabase Function secret named `ADMIN_DASHBOARD_PASSWORD`; do not add it as a GitHub Pages build variable.

## Useful Scripts

```sh
npm run dev
npm run build
npm run test
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

Recommended private setup:

Use Supabase with the private Node API. See `docs/supabase-setup.md`.

The old Airtable setup is archived in `docs/airtable-setup.md`. The old Google Sheets setup is archived in `docs/google-sheets-setup.md`.

Security note: `VITE_*` values are bundled into browser code. Do not put Supabase service role keys, Google service-account JSON private keys, or any other private token in a Vite env var. Private writes should go through the Node API or another backend route.

## GitHub Pages

GitHub Pages hosts the Vite frontend from `.github/workflows/deploy-pages.yml`. Because GitHub Pages is static hosting, private Google credentials still need to live in a backend.

The deploy workflow copies `dist/index.html` to `dist/404.html` after every build. This lets GitHub Pages fall back to the React app when the site is refreshed on a nested URL instead of showing GitHub's 404 page.

Share the Costco workbook with the Google service account email. Keep Google service-account credentials on the backend only.

For deployed dashboard unlock, also set one browser-safe backend URL as a repository variable:

```txt
VITE_AUTH_ENDPOINT=https://YOUR_PRIVATE_API_HOST/api/auth
```

For this GitHub Pages deployment, the recommended endpoint is the Supabase auth Edge Function:

```txt
VITE_AUTH_ENDPOINT=https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth
```

The Pages workflow will derive that URL automatically from `SUPABASE_PROJECT_REF` when `VITE_AUTH_ENDPOINT` is blank. Deploy the function with `.github/workflows/deploy-supabase-functions.yml`; it deploys the `auth` function.

If the same backend already exposes purchases at `/api/purchases`, you can set `VITE_PURCHASE_LOG_ENDPOINT` instead and the app will derive `/api/auth` from it. Do not put `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, Google service-account JSON, dashboard passwords, or demo passwords in `VITE_*` variables or GitHub Pages build variables. The auth function reads its private password from the Supabase Function environment only.

## Current Scope

- React/Vite frontend with left-sidebar navigation.
- Home command center with KPI cards, portfolio cards, alerts, pipeline status, and plus-triggered purchase logging.
- Costco dashboard with account cards, sheet-sourced transactions, relationships, and renewal/reward planning.
- Receipts tab with retailer-folder filtering, local receipt file selection, receipt entry, and folder creation.
- Detail views for US Mint, Dell, commodities, buyers, rewards, alerts, reports, and settings.
- Single-workbook Costco data source through the private Google Sheets service-account reader.

## Next Iterations

- Promote more dashboard panels from static placeholders to Supabase-backed records.
- Add Excel uploads for historical portfolio data.
- Promote static alert rules into a real alerts engine.
