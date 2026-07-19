# Personal Budgeting App — Project Context

## What this is
A personal budgeting and cash flow app built on Databricks as a learning project.
Two goals: (1) hands-on experience with Databricks ELT patterns and Databricks Apps,
(2) a personally useful replacement for a manual Excel cash flow tracker.

Data is sourced from Tiller Money, a financial data aggregator that syncs bank and
credit card transactions into a Google Sheet daily.

Owner: Edgar Damian (3Cloud, Azure Databricks consultant)

---

## What's already built

The full ELT pipeline is complete and running on a daily scheduled Job in Databricks:

```
Tiller Google Sheet
        ↓
Bronze notebooks (raw ingestion via gspread + Google Sheets API)
        ↓
Silver notebooks (typed, deduplicated, enriched)
        ↓
Gold notebooks (pre-aggregated for app views)
```

All notebooks live in `notebooks/` in this repo.

The AppKit app is scaffolded and **deployed** (RUNNING on Databricks Apps). Build status by tab:

| Tab | Route | Status | Key files |
|---|---|---|---|
| 1. Cash Flow | `/` | ✅ Built | `app/client/src/pages/cashflow/` |
| 2. Credit Cards | `/credit-cards` | ⬜ Stub (`ComingSoonPage`) | — |
| 3. Budget vs Actual | `/budget` | ✅ Built | `app/client/src/pages/budget/` |
| 4. Spend Analysis | `/spend` | ⬜ Stub (`ComingSoonPage`) | — |

Remaining work: build Tab 2 (Credit Cards) and Tab 4 (Spend Analysis).

---

## Infrastructure

- **Platform**: Databricks Free Edition
- **Unity Catalog**: `personal_budgeting`
- **Schemas**: `bronze`, `silver`, `gold`
- **Secret**: UC secret at `personal_budgeting.bronze` → key `google-sheets-key`
  (Google service account JSON for Sheets API access)
- **Google Sheet ID**: `1wq3swEY1vPMpfBCsMjAb_PrFhLA9lbGs5V0MOCNDZNE`
- **SQL Warehouse**: `9d84d8c8189a5847` (set in `app/databricks.yml` as `sql_warehouse_id`; also in `app/.env`)
- **CLI profile**: `personal-budgeting` (workspace `https://dbc-287e5e4a-7759.cloud.databricks.com`). Always pass `--profile personal-budgeting`.
- **Bundle target**: `default` (the only target; `default: true` in `databricks.yml`)
- **Deployed app URL**: https://personal-budgeting-182473690811914.aws.databricksapps.com

---

## Data layer — full table inventory

### Bronze (raw strings, full snapshots, overwrite on each sync)

| Table | Source | Rows (approx) |
|---|---|---|
| `bronze.transactions_raw` | Transactions sheet | 3,913 |
| `bronze.categories_raw` | Categories sheet | 35 |
| `bronze.balance_history_raw` | Balance History sheet | 226+ |

All columns are string type in Bronze. Audit columns `_ingested_at` and `_source` added.

### Silver (typed, deduplicated, enriched)

#### `silver.transactions`
| Column | Type | Notes |
|---|---|---|
| date | date | Transaction date |
| description | string | Cleaned merchant name |
| full_description | string | Raw description from institution |
| category | string | User-assigned budget category |
| amount | decimal(10,2) | **Negative = expense, positive = income** |
| account | string | Account display name |
| account_num | string | Last 4 digits |
| institution | string | Bank/card issuer |
| month | date | First of the month (for grouping) |
| transaction_id | string | Natural key from Tiller |
| date_added | date | When Tiller ingested it |
| categorized_date | date | When category was assigned |
| source | string | Feed source (Plaid) |
| group | string | Category group (joined from categories) |
| type | string | Income / Expense / Transfer |
| _ingested_at | timestamp | Pipeline audit column |

#### `silver.categories`
| Column | Type | Notes |
|---|---|---|
| category | string | Category name (natural key) |
| group | string | Discretionary / Financial / Living / Travel / Other / Transfer |
| type | string | Income / Expense / Transfer |
| hide_from_reports | boolean | Exclude from report views when true |

#### `silver.budget`
| Column | Type | Notes |
|---|---|---|
| category | string | |
| budget_month | date | First of month |
| budgeted_amount | decimal(10,2) | Monthly budget (0 if unset) |

Unpivoted from wide format (one column per month) to long format (one row per category per month).
Currently covers Jan–Dec 2026. 35 categories × 12 months = 420 rows.

#### `silver.balance_history`
| Column | Type | Notes |
|---|---|---|
| date | date | Snapshot date |
| account | string | Account display name |
| account_num | string | Last 4 digits |
| balance_id | string | Natural key from Tiller |
| institution | string | |
| balance | decimal(12,2) | Current balance (**positive even for credit cards**) |
| month | date | First of month |
| type | string | checking / savings / credit card |
| class | string | Asset / Liability |
| account_status | string | ACTIVE |
| date_added | date | |
| snapshot_at | timestamp | Combined date+time for accurate intraday ordering |
| _ingested_at | timestamp | |

### Gold (pre-aggregated, purpose-built for app views)

#### `gold.monthly_cashflow`
One row per month. **Scoped to account_num = '1871' (joint checking) only.**
CC spend appears here only as lump-sum CC payments from checking — not individual card charges.

| Column | Type | Notes |
|---|---|---|
| month | date | |
| income | decimal(12,2) | Sum of positive amounts (paychecks, transfers in) |
| outflows | decimal(12,2) | Sum of negative amounts (all money leaving checking) |
| cc_payments | decimal(12,2) | Subset of outflows: credit card payments |
| fixed_outflows | decimal(12,2) | Subset: Housing, Cars, Loan Repayment, Insurance, Utilities, Subscriptions |
| variable_outflows | decimal(12,2) | outflows - fixed_outflows - cc_payments |
| net_cashflow | decimal(12,2) | income + outflows |
| income_count | long | Number of income transactions |
| outflow_count | long | Number of outflow transactions |

~20 months of history (Dec 2024 – present).

#### `gold.credit_card_monthly`
One row per card per month. Current balance joined from latest balance snapshot.

| Column | Type | Notes |
|---|---|---|
| month | date | |
| account | string | Card display name |
| account_num | string | Last 4 |
| institution | string | |
| charges | decimal(12,2) | Total spend on card (positive/absolute value) |
| payments_received | decimal(12,2) | Payments applied to card |
| net_activity | decimal(12,2) | charges - payments_received |
| transaction_count | long | |
| current_balance | decimal(12,2) | Latest balance snapshot (positive even for liabilities) |
| balance_as_of | date | Date of latest snapshot |

~74 rows (3 cards × ~25 months).

#### `gold.monthly_budget_vs_actual`
One row per Expense category per month. Expense categories only (type = 'Expense').
Budget side drives the join — zero-spend months appear with actual = 0.

| Column | Type | Notes |
|---|---|---|
| budget_month | date | |
| category | string | |
| group | string | |
| type | string | Always 'Expense' in this table |
| hide_from_reports | boolean | |
| budgeted_amount | decimal(10,2) | 0 if unbudgeted |
| actual_amount | decimal(12,2) | Absolute value — positive for readability. This month only. |
| ytd_actual_amount | decimal(30,2) | Year-to-date actual for the category through budget_month (absolute value) |
| transaction_count | long | |
| variance | decimal(12,2) | budgeted - actual (positive = under, negative = over) |
| pct_used | double | NULL when budget = 0 (render as "—" in UI) |

372 rows (31 expense categories × 12 months). Note: a category can have `actual_amount > 0`
with `budgeted_amount = 0` (unbudgeted spend, e.g. Taxes/Hotels) → `pct_used` NULL and a large
negative `variance`. This is expected and drives the "unbudgeted" case in the Budget tab.

---

## Account reference

| Account | account_num | Institution | Type | Class | Notes |
|---|---|---|---|---|---|
| Spending Account | 1871 | Ally Bank | checking | Asset | **Joint checking — primary cash flow account** |
| Spending Account | 4072 | Ally Bank | checking | Asset | Separate spending account |
| Savings Account | 4061 | Ally Bank | savings | Asset | |
| Savings Account | 9920 | Ally Bank | savings | Asset | |
| Hilton Honors Aspire Card | 1002 | American Express | credit card | Liability | Heavy travel card |
| Prime Visa | 8957 | Chase | credit card | Liability | |
| Southwest Rapid Rewards® Plus | 4870 | Chase | credit card | Liability | |

---

## Key conventions

- **Tiller amount sign**: negative = expense / outflow, positive = income / inflow
- **Credit card balances**: stored as positive in balance_history even though they are Liabilities (class = Liability means money owed)
- **CC payments in transactions**: show up twice — negative from checking (money out), positive on the card (payment received). Gold tables handle this correctly already.
- **Transfers**: type = 'Transfer' transactions are internal moves (savings transfers, CC payments). Exclude from spending analysis. CC payments (category = 'Credit Card') ARE meaningful as cash outflows from checking.
- **hide_from_reports**: filter these out of user-facing views
- **pct_used NULL**: means unbudgeted category — render as "—" not "0%" or error

---

## App to build

### Stack
- AppKit (`@databricks/appkit` + `@databricks/appkit-ui`)
- Plugin: `analytics` (SQL Warehouse queries against Delta tables)
- React + TypeScript + Vite frontend
- Express backend (handled by AppKit)

### Scaffold command
```bash
databricks apps init --name personal-budgeting --features analytics
```

### Four tabs

---

#### Tab 1 — Cash Flow (default/landing tab) — ✅ BUILT
**Query**: `monthly_cashflow` (`config/queries/monthly_cashflow.sql`, joins `gold.monthly_cashflow` ×
`silver.categories` to bring in `type`). Files: `app/client/src/pages/cashflow/`.

Built with: page-wide **Groups slicer** + year>month selector; a **HeroBanner** (net cash flow,
income/outflow split, YTD outflows, savings rate); the 4 KPI cards with MoM deltas; the income-vs-outflows
trend bar chart; and a **MomBreakdownTable** (Last Mo · This Mo · Δ MoM). The redundant budget table that
used to live here was removed when Tab 3 shipped (budget detail is now owned by the Budget tab).

---

#### Tab 2 — Credit Cards
**Query**: `gold.credit_card_monthly`

- Current balance cards per card (always latest snapshot):
  - Hilton Honors Aspire (Amex 1002)
  - Prime Visa (Chase 8957)
  - Southwest Plus (Chase 4870)
- Monthly activity table: charges, payments received, net activity per card
- Bar chart: charges by card over last 6 months

---

#### Tab 3 — Budget vs Actual — ✅ BUILT
**Queries**: `budget_vs_actual` (per-month, param `budget_month`) + `budget_months` (distinct months for
the selector — added this session because the budget table's coverage differs from cashflow's history).
Files: `app/client/src/pages/budget/` (`BudgetPage`, `BudgetHealthHero`, `GroupSummaryCards`, `aggregate.ts`).

Built with: page-wide Groups slicer + year>month selector; a **budget-health hero** (SVG donut of actual
segmented by group, % of budget in the center colored by status, + 4 callouts: biggest overage, biggest
saving, over-budget count, YTD actual); **5 group roll-up cards** (zero-spend group → dimmed "No spend this
month"); and the **`BudgetBreakdownTable`** (reused from cashflow — Category · Group · Budget · Actual · YTD ·
Variance · % Used, with green / amber ≥90 / red >100 bars, NULL pct_used → "—"). All aggregation
(donut, callouts, cards, table) applies the same visibility filter: `hide_from_reports` + excluded groups.
Status→token map: `--success` (<90%), `--warning` (≥90%), `--destructive` (>100%). Group identity colors
use dedicated `--group-*` tokens defined in `client/src/index.css` (Living=green, Financial=blue,
Discretionary=amber, Travel=coral, Other=grey) — NOT the shadcn `--chart-*` tokens, which shift hue between
light and dark and so can't stay consistent with the design mockup.

---

#### Tab 4 — Spend Analysis
**Query**: `silver.transactions` (direct — not a Gold table)

This is the free-form analysis tab. Queries silver directly because it needs
flexible filtering that can't be pre-aggregated.

- Date range picker
- Filters: category (multi-select), group (multi-select), account (multi-select)
- Transaction table: date, description, category, amount, account
  - Sortable columns
  - Expenses shown as positive with a negative indicator (or just raw negative — designer's call)
- Summary bar/line chart: spend by category or by month depending on filter selection
- Row count and total spend shown above the table

---

## Repo structure

```
personal-budgeting/
├── CLAUDE.md                         ← this file
├── notebooks/
│   ├── nb_bronze_ingest_tiller.py
│   ├── nb_silver_transform_tiller.py
│   └── nb_gold_transform_tiller.sql
└── app/                              ← bundle root (run CLI + npm from here)
    ├── .env                          ← gitignored, local only
    ├── .env.example                  ← committed, placeholder values
    ├── databricks.yml                ← bundle: app resource, warehouse var, target `default`
    ├── app.yaml                      ← runtime manifest (command, env valueFrom)
    ├── package.json
    ├── config/queries/*.sql          ← one SQL file per query; queryKey = filename
    ├── shared/appkit-types/*.d.ts    ← AUTO-GENERATED by typegen (do not hand-edit)
    ├── server/server.ts              ← AppKit server (analytics plugin; cache disabled)
    ├── tests/smoke.spec.ts           ← Playwright smoke test (run by `apps validate`/`deploy`)
    └── client/src/
        ├── App.tsx                   ← router + nav tabs
        ├── lib/format.ts             ← currency/month formatters, currentMonthStart()
        └── pages/<tab>/              ← one folder per tab
```

---

## What to do next (in order)

Scaffold + Tab 1 (Cash Flow) + Tab 3 (Budget vs Actual) are done and deployed. Remaining:

1. Build **Tab 2 — Credit Cards** (`gold.credit_card_monthly`; swap `ComingSoonPage` at `/credit-cards`
   in `App.tsx` for a real page under `app/client/src/pages/credit-cards/`).
2. Build **Tab 4 — Spend Analysis** (queries `silver.transactions` directly — needs a new
   `config/queries/*.sql`).
3. When adding a query: write the `.sql`, run `npm run typegen`, THEN write the UI against the generated
   types. **Restart the dev server** so the new query registers (see Notes).
4. Extend `tests/smoke.spec.ts` with assertions for each new tab (currently only Cash Flow is asserted).
5. Deploy: from `app/`, `databricks apps deploy -t default --profile personal-budgeting`.

---

## Notes for Claude Code

- The SQL queries this app runs are against pre-aggregated Gold tables wherever possible.
  Only Tab 4 (Spend Analysis) queries `silver.transactions` directly.
- All monetary amounts in Gold tables use `decimal(12,2)`. Format as currency in the UI.
- `month` and `budget_month` columns are always first-of-month dates (e.g., 2026-07-01).
  Display as "July 2026" not "2026-07-01".
- The app is for personal use — only one user (Edgar), so per-user auth is not a concern.
  The default service principal auth model is sufficient.
- Prefer `@databricks/appkit-ui` components over building custom ones.
- If uncertain about AppKit API shapes, run `npx @databricks/appkit docs` from the app directory.

### Operational learnings (from building the Budget tab)

- **Analytics returns every column as a JSON string** — including DECIMAL/BIGINT/BOOLEAN. Never rely on
  truthiness (`!"false"` is `false`). Coerce explicitly: `Number(x)`, `String(x) === 'true'`. See the note
  at the top of `pages/cashflow/types.ts`.
- **A running dev server does NOT pick up a new `config/queries/*.sql` file** — queries register at server
  startup. Symptom: the page shows "Could not load budget data / Query execution failed" for the new query
  while others work. Fix: restart `npm run dev` (its `predev` re-runs `appkit plugin sync` + typegen).
- **Typegen needs a live warehouse.** Offline, a new query types as `result: unknown` (shown as
  `OFFLINE / degraded`); it self-heals to the real shape on the next connected `npm run typegen`. `predev`
  runs typegen automatically. Cast offline-degraded results in the page until then.
- **Smoke test reuses an existing server** (`reuseExistingServer: true` in `playwright.config.ts`). If a
  stray dev server is already on `DATABRICKS_APP_PORT` (8000), `apps validate`/`deploy` tests THAT stale
  server instead of the fresh build → confusing failures. Kill strays on 8000 first, or run a local verify
  server on a different port (`DATABRICKS_APP_PORT=8001 npm run dev`).
- **Deploy = `databricks apps deploy -t default --profile personal-budgeting`** (validates → deploys →
  starts, returns the URL). Do NOT use bare `databricks bundle deploy` (creates the app with `no_compute`,
  stays stopped). `apps validate` runs the smoke test as a gate, so keep it green.
- **Colors:** map semantic status to tokens (`--success` / `--warning` / `--destructive` /
  `--muted-foreground`). For categorical identity (e.g. the budget group palette) define dedicated tokens
  in `client/src/index.css` (we use `--group-*`) — do NOT reach for the shadcn `--chart-1..5` tokens for
  cross-theme identity: their hues differ between light and dark, so a series that looks right in one theme
  won't match a fixed design in the other.
- **Known lint noise:** `shared/appkit-types/analytics.d.ts` (auto-generated, DO NOT EDIT) trips
  `no-unused-vars` on its marker imports, so `npm run lint` reports errors there regardless of your changes.
  `databricks apps validate` uses ast-grep lint (`appkit lint`), which passes — that's the gate that matters.
- **Verify UI changes for real** by driving the running app with the Playwright browser (a temp spec that
  navigates the route + screenshots) rather than trusting typecheck alone.
