# Manual Pulls Order Tracking Plan

## Goal

Make manually maintained Google Sheets or Excel order rows visible in the dashboard so orders can be reviewed, cleaned, and logged without opening the spreadsheet every time.

## Dashboard Shape

Costco gets two new tabs:

- `Manual Pulls`: rows read from a Google Sheet or uploaded Excel file.
- `Combined Table`: Gmail-imported order rows plus manual-pull rows in one normalized view.

The existing Gmail import remains the automated source of truth for emails. Manual pulls are a second source for older history, corrections, or orders that Gmail parsing misses.

## Recommended Sheet Columns

Use these headers in Google Sheets or Excel:

```text
Status
Order #
Membership
Item
Item #
Quantity
Subtotal
Tax
Total
Date
Action
Source Notes
```

The dashboard should normalize these into:

```text
source, status, order, membership, item, itemNumber, quantity, subtotal, tax, total, date, action, sourceNotes
```

## Import Options

1. Google Sheets API read
   - Add a private API endpoint like `GET /api/manual-pulls/costco`.
   - Use a backend service account or existing Google OAuth.
   - Read a configured range such as `Costco Manual Pulls!A:L`.
   - Normalize rows server-side before sending them to React.

2. Excel upload
   - Add an upload control to `Manual Pulls`.
   - Parse `.xlsx` locally or through the private API.
   - Normalize rows with the same column contract.

## Safety Rules

- Manual rows should never overwrite Gmail rows automatically.
- Use `Combined Table` for comparison and reconciliation.
- Add a future duplicate detector using `Order # + Item # + Date + Total`.
- Keep raw spreadsheets out of Supabase unless the user explicitly chooses to save/import them.

## Next Implementation Step

Build `GET /api/manual-pulls/costco` backed by Google Sheets API read access, then replace the current empty `costcoManualPulls` placeholder with the API response.
