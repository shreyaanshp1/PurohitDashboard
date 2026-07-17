# Archived Airtable Purchase and Receipt Setup

This setup is currently disabled. The dashboard now uses Supabase through the private Node API; use `docs/supabase-setup.md` and keep `PURCHASE_STORAGE_DRIVER=supabase`.

The dashboard writes purchases, receipt folders, and receipts through the private Node API at `/api`. Keep the Airtable token server-side in `.env.local`; do not add a `VITE_` prefix.

## Airtable Base

Create one Airtable base with these tables and fields:

### Purchases

- `Date` - date
- `Store Name` - single line text
- `Total Amount` - currency or number
- `Category` - single select or text
- `Items/Notes` - long text
- `Rewards Earned` - currency or number
- `Logged At` - date/time or single line text

### Receipt Folders

- `Name` - single line text
- `Retailer` - single line text
- `Created At` - date/time or single line text

### Receipts

- `Date` - date
- `Retailer` - single line text
- `Folder` - single line text
- `Total Amount` - currency or number
- `Receipt URL` - URL
- `Notes` - long text
- `Logged At` - date/time or single line text

## Environment

Add these values to your local `.env.local` file:

```sh
VITE_PURCHASE_LOG_ENDPOINT=/api/purchases

PURCHASE_STORAGE_DRIVER=airtable
AIRTABLE_BASE_ID="mwqR7lE2jeQqCc"
AIRTABLE_PERSONAL_ACCESS_TOKEN="patWAwvdYi26QNWXW.fd78f1bafe54482e75cb66fa89de9e26dd28704d30ee3e7774c48a9ed37e49c7"
AIRTABLE_PURCHASES_TABLE=Purchases
AIRTABLE_RECEIPTS_TABLE=Receipts
AIRTABLE_RECEIPT_FOLDERS_TABLE=Receipt Folders

PURCHASE_LOG_ALLOWED_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
PURCHASE_LOG_SERVER_PORT=8787
```

The Airtable personal access token needs read/write access to the base. Restart `npm run dev` after changing `.env.local`.
