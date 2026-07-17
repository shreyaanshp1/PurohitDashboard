# Supabase Master Data Edge Function Setup

This guide deploys the Travel Master Data API to Supabase Edge Functions so the GitHub Pages frontend can read Google Sheets data without exposing the Google service-account private key in browser code.

Use the same Google service account that you use for transactional Google Sheets unless you want stricter separation. Share the Travel Master Data spreadsheet with that service account email as `Viewer`.

## 1. Confirm Prerequisites

You need:

- A Supabase project.
- The Supabase project ref, from a dashboard URL like `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`.
- The Travel Master Data spreadsheet ID.
- A Google service-account JSON file in `secrets/`, usually one of:
  - `secrets/google-sheet-api.json`
  - `secrets/google-service-account.json`
- The Travel Master Data Google Sheet shared with the service account email as `Viewer`.

Find the service account email:

```sh
node -e 'const fs = require("fs"); const key = JSON.parse(fs.readFileSync("secrets/google-sheet-api.json", "utf8")); console.log(key.client_email);'
```

If your file is named differently, replace `secrets/google-sheet-api.json` in the commands below.

## 2. Install and Login to Supabase CLI

Check whether the CLI is installed:

```sh
supabase --version
```

If it is not installed on macOS:

```sh
brew install supabase/tap/supabase
```

Then log in:

```sh
supabase login
```

This opens a browser and stores your local Supabase CLI auth session.

## 3. Link This Repo to Your Supabase Project

Replace `YOUR_PROJECT_REF` with the project ref from the Supabase dashboard URL.

```sh
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Set Function Secrets

Set the Google service-account JSON as one single-line secret:

```sh
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(node -e 'const fs = require("fs"); const key = JSON.parse(fs.readFileSync("secrets/google-sheet-api.json", "utf8")); process.stdout.write(JSON.stringify(key));')"
```

Set the master sheet ID:

```sh
supabase secrets set TRAVEL_MASTER_DATA_SPREADSHEET_ID=YOUR_MASTER_SHEET_ID
```

Set the header row:

```sh
supabase secrets set TRAVEL_MASTER_DATA_HEADER_ROW=1
```

Only set sheet names if you changed them from the defaults in `supabase/functions/travel-master-data/index.ts`:

```sh
supabase secrets set TRAVEL_MASTER_DATA_SHEET_NAMES="Travelers,Hotel_Properties,Hotel_Brands,Airports,National_Park_States,Cities,Currencies,Airlines,Credit_Cards,National Parks,Traveler_Loyalty_Accounts,States_Provinces,Rental_Car_Companies,Expense_Categories,Hotel_Chains,Loyalty_Programs,Place_Types,Countries"
```

Verify the secrets exist without printing their values:

```sh
supabase secrets list
```

## 5. Deploy the Edge Function

```sh
supabase functions deploy travel-master-data
```

The function URL will be:

```txt
https://YOUR_PROJECT_REF.supabase.co/functions/v1/travel-master-data
```

## 6. Test the Function

```sh
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/travel-master-data"
```

Expected shape:

```json
{
  "success": true,
  "readOnly": true,
  "spreadsheetId": "YOUR_MASTER_SHEET_ID",
  "sheets": []
}
```

The real response should include populated `sheets` entries.

## 7. Point GitHub Pages at the Function

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Go to `Secrets and variables > Actions`.
4. Open the `Variables` tab.
5. Create or update:

```txt
VITE_TRAVEL_MASTER_DATA_ENDPOINT=https://YOUR_PROJECT_REF.supabase.co/functions/v1/travel-master-data
```

This is a variable, not a secret, because it is a public API URL. Do not put the Google private key or service-account JSON in GitHub variables.

## 8. Enable GitHub Pages

In GitHub:

1. Open `Settings > Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Push to `main` or run the `Deploy GitHub Pages` workflow manually from the `Actions` tab.

## Troubleshooting

`Missing service-account client email.`

The `GOOGLE_SERVICE_ACCOUNT_JSON` secret was not set correctly, or the JSON file path in the command was wrong.

`Missing service-account private key.`

The JSON secret is incomplete. Re-run the `GOOGLE_SERVICE_ACCOUNT_JSON` command from the actual service-account key file.

`The caller does not have permission` or `Requested entity was not found.`

Open the Travel Master Data Google Sheet and share it with the service account email as `Viewer`.

`Function not found`

Confirm you deployed with:

```sh
supabase functions deploy travel-master-data
```

Also confirm the URL uses the same `YOUR_PROJECT_REF` that you linked and deployed to.

The GitHub Pages UI still shows fallback or empty master data.

Confirm the repository Actions variable is named exactly:

```txt
VITE_TRAVEL_MASTER_DATA_ENDPOINT
```

Then rerun the GitHub Pages deployment workflow so Vite rebuilds with the variable.
