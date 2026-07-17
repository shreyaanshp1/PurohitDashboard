# Supabase Purchase and Receipt Logging Setup

This setup keeps purchase data out of cookies and out of `localStorage`. The React app posts to `/api/purchases`; Vite proxies that request to a private Node API; the Node API writes to Supabase with a backend-only service role key.

## 1. Create the Table

1. Open Supabase.
2. Create a new project.
3. Go to `SQL Editor`.
4. Paste and run `supabase/schema.sql`.

The schema creates `public.purchases`, `public.receipt_folders`, `public.receipts`, `public.costco_orders`, and `public.us_mint_orders`.

## 2. Configure `.env.local`

Use backend-only Supabase values. Do not prefix the service role key with `VITE_`.

```sh
VITE_PURCHASE_LOG_ENDPOINT=/api/purchases

PURCHASE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=your_secret_key

GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/google/oauth/callback
GOOGLE_OAUTH_TOKEN_FILE=secrets/google-oauth-token.json
COSTCO_GMAIL_QUERY='{from:orderstatus@costco.com from:Costco@orders.costco.com from:order-refund@costco.com from:order-cancel@costco.com from:Costco.com@memberedelivery.com} in:anywhere'
COSTCO_GMAIL_IMPORT_LIMIT=5000
US_MINT_GMAIL_QUERY='from:(orders@email.usmint.gov) subject:confirmed'
US_MINT_GMAIL_IMPORT_LIMIT=5000
```

You can find these in Supabase under `Project Settings > API Keys`. Paste the project URL without `/rest/v1` at the end. For newer projects, use a server-side secret key. For older projects, the backend also accepts `SUPABASE_SERVICE_ROLE_KEY`.

Use the secret/service key only on the private Node API. Never put it in frontend code, a deployed static site, or any `VITE_*` variable.

## 3. Run the App

```sh
npm run dev
```

This starts:

- `http://127.0.0.1:8787` for the private purchase API.
- `http://127.0.0.1:5173` for the React dashboard.

The browser calls `/api/purchases`, `/api/receipt-folders`, `/api/receipts`, `/api/receipt-files`, `/api/google/oauth/*`, `/api/costco-orders`, and `/api/us-mint-orders`; Vite proxies those requests to the private API.

## 4. Gmail OAuth

Create an OAuth client in Google Cloud with the Gmail API enabled. Use a desktop or web OAuth client and add this redirect URI:

```text
http://127.0.0.1:8787/api/google/oauth/callback
```

The app requests `https://www.googleapis.com/auth/gmail.readonly`, stores the refresh token in `secrets/google-oauth-token.json`, and keeps raw email bodies out of Supabase.

## 5. Privacy Notes

The current local setup is private to your machine and your Supabase project. It does not store purchase data in browser storage.

If you deploy this dashboard publicly, add real user authentication before allowing writes. For a personal local dashboard, keeping the service role key in `.env.local` and the API bound to `127.0.0.1` is the simplest private setup.
