# Google Stitch Setup

Google Stitch is a Google Labs UI design tool for turning prompts, images, and rough app ideas into high-fidelity UI screens, prototypes, Figma-ready designs, and frontend code.

Use Stitch as a design accelerator for this dashboard, not as the source of truth for credentials, data access, or business logic.

## 1. Start A Stitch Project

1. Open `https://stitch.withgoogle.com`.
2. Create a new project for `Santosh Portfolio Command Center`.
3. Add this app context:
   - A private operations dashboard for Costco, US Mint, Dell, commodities, buyers, rewards, alerts, receipts, reports, and settings.
   - Data-first interface, not a marketing site.
   - Left sidebar navigation.
   - Dense but readable tables, compact cards, 8px radius, restrained colors, clear status badges.
   - The Costco tracker workbook is the only live Google Sheets data source.

## 2. Add A Design Source Of Truth

Create or update Stitch's design notes with these rules:

```md
# Design System

Use a quiet operations-dashboard style.

Layout:
- Left sidebar navigation.
- Main content uses full-width sections, compact panels, data tables, and toolbars.
- Do not create landing-page hero sections.
- Do not nest cards inside cards.

Shape:
- Cards and panels use 8px border radius.
- Buttons use 8px border radius.
- Status pills may use full pill radius.

Typography:
- Use system sans-serif or Inter-like type.
- Do not scale font size with viewport width.
- Keep compact panel headings smaller than page titles.

Color:
- Background: #f5f7f8
- Panel: #ffffff
- Ink: #202124
- Muted text: #687076
- Border: #dfe4e8
- Sidebar: #22272b
- Blue: #1d6fb8
- Green: #187a5b
- Amber: #a06100
- Rose: #bd3f4f
- Violet: #7452a7

Components:
- Use icon buttons where a common icon exists.
- Use segmented tabs for section tabs.
- Use toggles for binary settings.
- Use tables for operational records.
- Use log-row buttons in spreadsheet-connected sections.
```

## 3. Prompt Stitch For Screens

Use prompts like:

```txt
Design the Settings screen for Santosh Portfolio Command Center.
Follow the design system exactly.
Show the Costco tracker workbook connection and local/static rows for the other sections.
Keep the UI dense, professional, and table-first.
```

```txt
Design a Google Sheets-connected Costco dashboard tab.
Include a compact toolbar with connection status, refresh, and Log Row.
Below it, show spreadsheet tabs for Account Information, Transactions, Rewards Tracker, and Category Summary.
Use a data table with sortable headers and status pills.
```

```txt
Design a profile page for the operator.
Make it social-dashboard inspired, but still operational.
Include identity, portfolio count, account records, rewards tracked, buyers, priority signals, and recent highlights.
```

## 4. Bring Designs Back Into This Repo

When Stitch gives you a design:

1. Export frontend code or paste the design into Figma.
2. Use it as visual reference only.
3. Preserve the app's existing React data flow:
   - Frontend React components in `src/App.jsx`
   - Shared styling in `src/styles.css`
   - Backend routes in `server/purchaseLoggerServer.mjs`
   - Google Sheets backend access in `server/sheetsClient.mjs`
4. Do not copy any secret, API key, service-account JSON, or Supabase service-role key into Stitch prompts, screenshots, Figma, or generated code.

## 5. Security Rules

- Never put private values in `VITE_*` variables.
- Never paste `.env.local` into Stitch.
- Never upload service-account JSON screenshots.
- Keep Supabase service-role keys on the backend only.
- Keep Google private keys in `secrets/` locally or Supabase Function secrets in deployment.
- Treat Stitch output as UI draft code that still needs review before merging.

## 6. Implementation Checklist

- Match existing sidebar and table patterns.
- Keep dashboard pages data-first.
- Confirm text fits on mobile.
- Verify with `npm run build`.
- Verify service tests with `npm run test`.
- Audit that no secret file is under `src/`.
