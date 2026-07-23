# Google Stitch Prompt

Create a new private operations dashboard from scratch. Do not copy or reference any existing interface. Focus on the product purpose, data model, workflows, and section behavior below. The application is a secure personal/business command center for tracking purchase activity, Costco memberships and rewards, travel planning records, commodities/US Mint inventory, and receipts.

The app is backed by private server-side services. Sensitive values must never be exposed to browser code. Authentication is a backend-only dashboard password check using `ADMIN_DASHBOARD_PASSWORD`; username login, signup, and password reset are intentionally disabled. Google service-account credentials, backend database credentials, and dashboard passwords must remain on backend runtimes only. Browser-facing configuration may contain only safe API endpoints. Do not use Supabase for this new version.

Core data sources:
- The Costco tracker workbook is the only live Google Sheets source and is accessed only through backend/service-account routes.
- A private backend may store non-spreadsheet artifacts such as uploaded receipt files and temporary import state, but the design should not depend on Supabase.
- The connected Costco workbook should support reading rows, refreshing rows, and appending new rows through backend routes.

Only create the following sections: Home, Costco, Travel, Commodities, Receipts.

## Home

Purpose: Provide an operations summary across the tracked areas and allow quick logging of purchase activity.

Functionality:
- Summarize total active operating areas: Costco, Travel, Commodities, Receipts, and supporting operations.
- Surface the top two Costco accounts needing renewal review based on verification status, renewal-open date, or expiration date.
- Show Costco Executive reward totals, including total estimated rewards earned and total spend still needed to reach reward caps.
- Show combined commodities record count, including bullion/commodity inventory plus US Mint account/profile records.
- Show open operational work such as Costco records needing verification, missing data, and configured alerts.
- Include recent pipeline/activity status for spreadsheet-backed records, backend imports, and file uploads.

Purchase logging workflow:
- Create purchase records through the private backend, not direct browser database access.
- Persist purchases through the private backend to a configured Google Sheet or other non-Supabase backend store.
- Required purchase fields: purchase date, store name, total amount, category.
- Optional purchase fields: item/order notes and rewards earned.
- Support common store profiles such as Costco, Target, Amazon, Grocery Store, Walmart, and Other.
- Estimate rewards by store profile when rewards are not manually entered. Costco uses a 2% estimate.

## Costco

Purpose: Manage Costco memberships, household/primary relationships, renewal timing, reward tracking, and transactions.

Primary data sources:
- Google Sheets source id: `costco`.
- Spreadsheet env: `COSTCO_SPREADSHEET_ID`.
- Default sheets: `Account Information`, `Transactions`, `Rewards Tracker`, `Category Summary`.

Account data model:
- Membership number.
- Role: Primary, Household/Add-on, Needs Verification.
- Linked primary membership number.
- Membership type.
- Executive membership flag.
- Status.
- Owner name.
- Sign-in email and profile email.
- Phone and address.
- Member since date.
- Expiration date.
- Renewal-open date.
- Reward cycle start.
- Estimated 2% reward.
- Remaining reward amount to the annual cap.
- Spend needed to cap.
- Reward last updated date.
- Account manager / primary member.
- Household member.
- Notes.
- Needs verification flag.

Account workflows:
- Pull Costco account records from the connected `Accounts` sheet when available.
- Fall back to local seeded account records only when the sheet is not configured.
- Count primary and household/add-on accounts separately.
- Prioritize accounts needing verification, past-due renewal, renewal within 14 days, and renewal within 45 days.
- Support editing account fields and saving changes back to the connected Google Sheet row when available.
- If Google Sheets is not connected, keep edits local only.

Rewards logic:
- Costco Executive reward rate is 2%.
- Reward cap is `$1,250` per cycle.
- Spend needed to cap is based on the remaining reward amount divided by 2%.
- Track total estimated rewards earned, remaining to cap, spend needed to cap, near-cap accounts, and reward-cycle dates.
- Exclude taxes, shipping, returns, Costco Shop Cards, and other non-qualified categories from reward assumptions.

Renewal reminder logic:
- Renewal reminder lead time is 14 days.
- Reminder date is renewal-open date minus 14 days when renewal-open exists; otherwise use expiration date minus 14 days.
- Past-due or currently due reminders should be treated as high priority.
- Generate renewal reminder message text containing owner, membership type, membership number, and renewal/expiration date.
- SMS/email delivery can be wired through a backend provider later; the current requirement is to generate and queue the reminder payload safely.

Order and transaction workflows:
- Show Google Sheets transaction rows from `Transactions`.
- Show workbook category and reward summary rows from `Category Summary` and `Rewards Tracker`.
- New spreadsheet rows should append through backend Google Sheets routes.

## Travel

Purpose: Track trips, flights, certificates/awards, and supporting travel reference data from local/static rows.

Travel rows:
- `Trips`: trip name, destination, start date, end date, status, budget, notes.
- `Flights`: flight, from, to, depart date, depart time, airline, confirmation, status, notes.
- `Certificates_Awards`: program, account, certificate/award, value, expiration date, status, notes.

Travel workflows:
- Calculate upcoming trips from trip start/date fields.
- Calculate upcoming flights from flight depart/date fields.
- Find certificates/awards expiring within roughly 90 days and flag them for review.
- Allow search/filter across travel records.

## Commodities

Purpose: Combine bullion/commodity inventory with US Mint account and collectible tracking into one operating area. Do not create a separate primary US Mint section.

Primary data sources:
- Google Sheets source id: `commodities`.
- Spreadsheet env: `COMMODITIES_SPREADSHEET_ID`.
- Default sheets: `Inventory`, `Sales`.
- US Mint account/profile records are included in this section for context and totals.

Inventory data model:
- Item.
- Quantity.
- Cost basis.
- Current value.
- Gain/loss.
- Buyer or buyer assignment.

US Mint profile data model included inside Commodities:
- Account nickname.
- Owner.
- Email.
- US Mint account number.
- Shipping name.
- Phone.
- Address.
- Primary card.
- Card expiration.
- Status.
- Notes.

Commodities workflows:
- Read commodities inventory and sales rows from Google Sheets through backend routes.
- Append new inventory or sales rows through backend Google Sheets routes.
- Combine US Mint profile counts with commodity inventory counts for summary metrics.
- Track active US Mint profiles, inventory lots, buyer coverage, bullion/collectibles records, cost basis, current value, and gain/loss.
- Keep buyer assignment visible because commodity and US Mint records often need resale/outlet matching.

## Receipts

Purpose: File purchase receipts by retailer, attach receipt files, and persist receipt metadata through backend-controlled storage without Supabase.

Primary data sources:
- Google Sheets or another non-Supabase backend store for receipt folders.
- Google Sheets or another non-Supabase backend store for receipt metadata.
- Private backend file upload route for receipt files.

Receipt folder model:
- Folder id.
- Folder name.
- Retailer.
- Created timestamp.

Receipt model:
- Receipt id.
- Receipt date.
- Retailer.
- Folder id.
- Folder name.
- Total amount.
- Receipt URL.
- Receipt file name.
- Receipt content type.
- Notes.
- Created/logged timestamp.

Receipt workflows:
- Load receipt folders and receipt records through the private backend.
- Create retailer folders when a receipt belongs to a new retailer.
- Avoid duplicate folder creation by matching folder names case-insensitively.
- Filter receipts by retailer and support searching across receipt metadata.
- Save receipt records only after validating that retailer/folder is present and at least one receipt detail exists: amount, file, URL, or notes.
- Upload receipt files through the private backend, not directly from the browser to storage.
- Accept PDF and image receipt files.
- Store receipt files with sanitized names and private filesystem permissions.
- Return a private API URL for retrieving uploaded receipt files.
- Enforce a server-side maximum file size.

Security and implementation constraints:
- Do not expose Google service-account JSON, private keys, backend database credentials, or dashboard password values in frontend code.
- All writes to Google Sheets, receipt files, and any backend-owned datastore go through backend routes.
- The Costco spreadsheet id may be configured by environment variable and may be either a raw id or share URL.
- When the Costco workbook is not available, the section should clearly operate from fallback/empty data without pretending the source is live.
