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

All notebooks live in `notebooks/` in this repo. The app is what needs to be built.

---

## Infrastructure

- **Platform**: Databricks Free Edition
- **Unity Catalog**: `personal_budgeting`
- **Schemas**: `bronze`, `silver`, `gold`
- **Secret**: UC secret at `personal_budgeting.bronze` → key `google-sheets-key`
  (Google service account JSON for Sheets API access)
- **Google Sheet ID**: `1wq3swEY1vPMpfBCsMjAb_PrFhLA9lbGs5V0MOCNDZNE`
- **SQL Warehouse**: [add your warehouse ID to `.env`]

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
| actual_amount | decimal(12,2) | Absolute value — positive for readability |
| transaction_count | long | |
| variance | decimal(12,2) | budgeted - actual (positive = under, negative = over) |
| pct_used | double | NULL when budget = 0 (render as "—" in UI) |

372 rows (31 expense categories × 12 months).

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

#### Tab 1 — Cash Flow (default/landing tab)
**Query**: `gold.monthly_cashflow`

- Month selector (default: current month)
- Summary cards row:
  - Income (green)
  - Fixed Outflows (neutral)
  - CC Payments (neutral)
  - Variable Outflows (neutral)
  - Net Cash Flow (green if positive, red if negative)
- Trend bar chart: income vs total outflows by month (last 6–12 months)
- Breakdown table for selected month showing category of outflow

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

#### Tab 3 — Budget vs Actual
**Query**: `gold.monthly_budget_vs_actual`

- Month selector (default: current month)
- Category group filter (Discretionary / Financial / Living / Travel / Other)
- Table columns: Category, Group, Budget, Actual, Variance, % Used
  - Highlight over-budget rows (pct_used > 100) in red
  - Render NULL pct_used as "—"
  - Hide rows where hide_from_reports = true by default (toggle to show)
- Bar chart: actual vs budget by category for selected month

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
└── app/
    ├── .env                          ← gitignored, local only
    ├── .env.example                  ← committed, placeholder values
    ├── databricks.yml
    ├── app.yaml
    ├── package.json
    └── ... (AppKit scaffold)
```

---

## What to do next (in order)

1. Run `databricks aitools install` in terminal
2. From inside `app/`, run `databricks apps init --name personal-budgeting --features analytics`
3. Configure `.env` with `DATABRICKS_HOST` and `WAREHOUSE_ID`
4. Review generated scaffold structure
5. Build Tab 1 (Cash Flow) first — it's the primary view and uses the simplest Gold table
6. Iterate locally with `npm run dev`
7. Build remaining tabs in order: Credit Cards → Budget vs Actual → Spend Analysis
8. Run `databricks apps deploy` when ready

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
