# Archived Google Sheets Purchase Logging Setup

This setup is currently disabled. The dashboard now uses Supabase through the private Node API; use `docs/supabase-setup.md` and keep `PURCHASE_STORAGE_DRIVER=supabase`.

The React app posts purchase data to a write-capable endpoint. For a personal dashboard, the simplest endpoint is the Apps Script web app in `google-apps-script/purchaseLogger.gs`. For production, use a backend or serverless route with a Google service account.

## Environment Variables

Frontend `.env.local`:

```sh
VITE_GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_GOOGLE_SHEET_ID=your_sheet_id
VITE_GOOGLE_SHEET_NAME=Purchases
VITE_GOOGLE_SHEETS_SHARED_SECRET=your_random_shared_string
```

Production backend `.env` if using a service account:

```sh
GOOGLE_SERVICE_ACCOUNT_EMAIL=purchase-logger@your-project.iam.gserviceaccount.com

GOOGLE_PRIVATE_KEY="paste_private_key_here_with_escaped_newlines"

GOOGLE_SHEET_ID=your_sheet_id

GOOGLE_SHEET_NAME=Purchases
```

Do not put `GOOGLE_PRIVATE_KEY` in a `VITE_*` variable. Vite exposes `VITE_*` variables to the browser bundle.

## Apps Script Path

1. Open your existing Google Sheet.
2. Create or pick a tab named `Purchases`.
3. Open `Extensions > Apps Script`.
4. Paste `google-apps-script/purchaseLogger.gs`.
5. Open `Project Settings > Script Properties`.
6. Add `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_NAME`, and `PURCHASE_LOG_SECRET`.
7. Click `Deploy > New deployment`.
8. Select `Web app`.
9. Set `Execute as` to `Me`.
10. Set access to the most private option that still lets your dashboard call it.
11. Authorize the script and copy the `/exec` URL into `VITE_GOOGLE_SHEETS_WEB_APP_URL`.

If the dashboard reports that Apps Script returned HTML instead of JSON, the web app is probably showing a Google sign-in page. Reopen `Deploy > Manage deployments`, edit the active web app deployment, and change `Who has access` to an option your browser app can call directly. For a no-auth local dashboard, that is usually `Anyone`. If your Workspace admin blocks that option, use the service-account backend path instead.

## Google Cloud Console Service-Account Path

1. Open Google Cloud Console and select or create a project.
2. Go to `APIs & Services > Library`.
3. Search for `Google Sheets API`.
4. Click `Enable`.
5. Go to `IAM & Admin > Service Accounts`.
6. Click `Create service account`.
7. Name it something like `purchase-logger`.
8. You usually do not need to grant broad project roles for this use case.
9. Open the created service account, go to `Keys`, click `Add key > Create new key`, choose `JSON`, and download it.
10. Put the service account email and private key in backend-only environment variables.
11. Open your Google Sheet, click `Share`, and add the service account email as `Editor`.
12. Build a serverless/API route from `examples/node-service-account-log-purchase.mjs`.
13. Point the frontend at that route with `VITE_PURCHASE_LOG_ENDPOINT`.

API keys are not enough for private Sheet writes. They are for anonymous access to public data. Appending rows through the Sheets API requires an authenticated caller with a write scope such as `https://www.googleapis.com/auth/spreadsheets`.
