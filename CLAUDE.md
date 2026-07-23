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
| 2. Forecast | `/forecast` | ✅ Built | `app/client/src/pages/forecast/` |
| 3. Credit Cards | `/credit-cards` | ✅ Built | `app/client/src/pages/creditcards/` |
| 4. Budget vs Actual | `/budget` | ✅ Built | `app/client/src/pages/budget/` |
| 5. Spend Analysis | `/spend` | ✅ Built | `app/client/src/pages/spend/` |

**All five tabs are built.** (`ComingSoonPage` is no longer routed anywhere.)
Nav order: Cash Flow · Forecast · Credit Cards · Budget vs Actual · Spend Analysis.
A header-level **Demo mode** toggle pseudonymizes all on-screen data across every tab (see the Demo mode
section below).

---

## Branding — House of Damian

The app is branded **House of Damian** (premium fintech, dark-default). Applied from the branding handoff:

- **Identity**: green heraldic crest (ledger-bars mark) + "HOUSE OF DAMIAN" wordmark. In-app crest is an
  inline `HodCrest` component in `App.tsx` (`currentColor` → `text-primary`, adapts to theme). Source SVGs in
  `app/client/public/`: `favicon.svg` (solid green shield, ink cutout — the tab icon), `hod-crest.svg`
  (full-color gradient, marketing), `hod-crest-mono.svg` (stroke/mono). PNG favicons (16/32/48/180/192/512)
  were rasterized from `favicon.svg` via headless chromium (no local image tooling — see below).
- **Theme**: dark is the default (`defaultTheme="dark"` in `main.tsx`, `enableSystem` kept). Tokens live in
  `client/src/index.css` — **light in `:root`, dark in `.dark`** (next-themes `attribute="class"`; the old
  `@media prefers-color-scheme` block was removed). Signal Green is `--primary` (`#16b981` light / `#34d399`
  dark), so the active nav pill is green automatically. Ink `#07080a`, Surface `#101317`, Elevated `#171b20`.
  `--brass` is a premium accent. Semantic tokens unchanged in meaning (success/destructive/warning); the
  `--group-*` / `--card-*` identity colors are theme-independent and stay in `:root`.
- **Naming**: `<title>` and `site.webmanifest` name/short_name are "House of Damian". The Databricks **app
  resource name stays `personal-budgeting`** (deployment identifier — not user-facing, ≤26 chars).
- **To regenerate PNG favicons** (no ImageMagick/sharp installed): a throwaway Playwright spec renders
  `favicon.svg` at each size with `omitBackground` and screenshots the `<svg>` element into `client/public/`.

---

## Demo mode

A manual, app-wide toggle (**Demo** button in the header, next to the theme switch) that pseudonymizes
every figure on screen so the app can be shown off without exposing real finances. State lives in
`localStorage` (`hod.demoMode`), defaults **off**, and is per-browser — it never affects other viewers or
the data. Files: `client/src/lib/demoMode.tsx` (context + `useDemoMode`), `demoData.ts` (masking),
`demoAccounts.ts` (last-4 aliases), `analyticsQuery.ts` (the wrapper), `components/DemoToggle.tsx`.

**Architecture — one choke point.** Every page fetches through `useAnalyticsQuery`. Demo mode is a thin
wrapper (`lib/analyticsQuery.ts`) around AppKit's hook: identical behavior, but when demo mode is on it runs
each result array through `maskRows()` before it reaches the page. **All five pages import the hook from
`../../lib/analyticsQuery`, NOT from `@databricks/appkit-ui/react`** — keep it that way when adding queries,
or the new query won't be masked. The wrapper's signature is pinned via `Parameters`/`ReturnType`; per-query
generics collapse to the default, which is harmless because every call site already casts `data` to its own
row type (`as SomeRow[]`).

**What `maskRows` does** (column-name driven, so it needs no per-query config):
- **Money** → each *row* is scaled by its own multiple (0.4×–2.6×), deterministically hashed from the row so
  it's stable across re-renders and identical for the same card/category across tabs. The factor is shared by
  every monetary field in a row, so intra-row relationships still reconcile (`variance = budget − actual`,
  `pct_used`, net totals). Different rows land on different multiples → varied, organic-looking numbers.
- **Merchant/description** fields (`/desc|description|merchant/i`) → replaced with a fake label, deterministic
  per source string; income-ish rows (direction `in`, type/group Income) draw from an income-label pool so
  the forecast/ledger still reads sensibly.
- **`account_num`** → swapped for a fixed fake last-4 via `demoAccounts.ts` (`1002→5581`, `1871→2048`, …).
  Because `account_num` is *also* the identity key for card colors/names, the lookups in
  `creditcards/cards.ts` (`CARD_META`) and `spend/aggregate.ts` (`ACCOUNT_COLOR`) run the value through
  `realAccountNum()` first (maps a demo alias back to the real key; no-op when off). **Add an alias here
  whenever a new account/card last-4 appears in displayed data.**
- **Passthrough** (untouched): counts, ids, dates/months, `day_of_month`, `pct_used`, `confidence`, cadence,
  anchors, and non-numeric strings (category, group, account name, institution, type).

**Forecast is special.** The page mostly ignores its queries in favor of the saved plan in `localStorage`
(`hod.forecast.plan.v1`) — `stored.items` (materialized ledger), `stored.startBal` (balance override), and
`stored.plan` (planned payments) are all real and would bypass query masking. So in demo mode the page runs
off an **ephemeral empty plan** (`EMPTY_PLAN`) which makes everything derive from the (masked) queries. Demo
edits go to a separate in-memory `demoPlan` that is **never persisted**, and "Reset plan" is guarded so it
can't wipe the real saved plan. Toggling demo off restores the real plan untouched.

**Not a privacy boundary.** Masking is client-side — the real query still runs and true values exist in the
browser's network tab. This is deliberate (an over-the-shoulder demo, never a hand-off); don't "harden" it
into a server-side thing without a reason.

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

#### `gold.forecast_recurring`
One row per **detected recurring** inflow/outflow on the 1871 checking account (~9 rows).
Seeds the Forecast tab. Detection runs in gold — **never in the app**. This is deliberately
NOT a copy of `silver.transactions`: it materializes the recurring *signals*, not the ledger.

| Column | Type | Notes |
|---|---|---|
| description | string | Merchant/label, **aliased** (see below) |
| category | string | |
| group | string | Drives the ledger dot color |
| direction | string | `'in'` or `'out'` — sign lives here |
| typical_amount | decimal | **Positive magnitude** (median) |
| cadence | string | `'monthly'` \| `'semimonthly'` \| `'biweekly'` |
| day_of_month | int | monthly → median day; semimonthly → 15 (app also posts EOM); biweekly → NULL |
| anchor_date | date | biweekly only — app steps +14 days; NULL otherwise |
| is_overridden | boolean | TRUE when `schedule_overrides` forced the cadence |
| occurrence_count, months_present, last_seen, confidence | | diagnostics |

**Detection** = group by category+merchant over the last **6 completed** months, keep anything
present in ≥3, median amount + median day-of-month, `typical_amount >= 20`.

Three things that are easy to get wrong and are already handled — **read before editing this table**:

1. **Merchant aliasing.** Tiller descriptions drift, which splits one stream into two
   half-confidence rows. The `merchant` CASE block collapses known aliases:
   `%Eisen%` → `Eisen Payroll` (payroll description changed mid-March 2026),
   `Requested transfer from Ally%`, and `Evergy%` (its description **embeds the bill amount**,
   so it would split the first month the bill changes). **Add a line here whenever a description drifts.**
2. **biweekly vs semimonthly.** Average gap can't separate 14d from ~15.2d. Cadence is decided by
   *where in the month* hits land: ≥80% on the 15th (14–16) or last day (≥28 or the 1st) → `semimonthly`,
   else `biweekly`. The gap guard (≤18d) runs first, so monthly bills on the 26th–30th are unaffected.
3. **Anchor freshness.** Detection stats use completed months only, but `anchor_date`/`last_seen` come
   from the newest actual occurrence **including the current month** — a biweekly anchor from the last
   completed month can be 7 weeks stale and every `+14` step inherits the error.

**`schedule_overrides`** is the escape hatch for *forward-looking* schedule changes that history
cannot predict. Currently: `Requested Transfer (Ally x4072)` biweekly → **semimonthly** (moving to
the 15th + last day, confirmed 2026-07-21). **Remove an override once ~3 months of actuals exist
under the new schedule** — detection then finds it on its own and a stale override starts fighting
the data.

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
**Excludes internal transfers** in/out of the 1871 checking account (`WHERE COALESCE(c.type,'') <> 'Transfer'
OR category = 'Credit Card'`) — the generic `Transfer` category carried ~$200k of transfers-in that inflated
Income and net cash flow. `Credit Card` payments are kept (type=Transfer, but real cash out → own KPI card).
NOTE: the deployed `gold.monthly_cashflow` is per month+group+category (has `group`/`category` columns); the
repo notebook `nb_gold__transform_tiller.sql` is an older month-level version and is out of date vs deployed.

Built with: a page-wide **Group → Category hierarchy slicer** (`components/GroupCategorySlicer`, shared with
the Budget tab — expandable groups with a group checkbox that toggles all its categories, plus per-category
checkboxes; single source of truth is `excludedCategories`, group state is derived
checked/indeterminate/unchecked; tree via `buildGroupTree` in `lib/groupColors.ts`) + year>month selector; a
**HeroBanner** (net cash flow,
income/outflow split, YTD outflows, savings rate); the 4 KPI cards with MoM deltas; the income-vs-outflows
trend bar chart; and a **MomBreakdownTable** (Outflow Breakdown: Last Mo · This Mo · Δ MoM). The breakdown
includes Expense categories **plus the `Credit Card` payment** so it reconciles with the KPI cards + bar
chart, whose Total Outflows = fixed + CC payments + variable (Income and other transfers stay excluded).
The redundant budget table that used to live here was removed when Tab 3 shipped (budget detail is now owned
by the Budget tab).

---

#### Tab 2 — Forecast — ✅ BUILT
**Queries**: `forecast_recurring` + `checking_balance` (both no-param) + **reuses** `credit_card_monthly`
for the per-card balances owed. Files: `app/client/src/pages/forecast/` (`ForecastPage`, `KpiStrip`,
`BalanceChart`, `PaymentPlanner`, `ForecastLedger`, `MoneyInput`, `forecast.ts`, `recurring.ts`,
`dates.ts`, `storage.ts`, `types.ts`).

The app's **first forward-looking and first user-editable surface**. Projects the ··1871 checking
balance **56 days / 8 weeks** from today. Layout top-to-bottom: header → KPI strip (4 tiles) →
full-width daily balance chart → payment planner (3 cards) → week-grouped forecast ledger.

Two architecture rules, both load-bearing:
- **No writeback to Databricks.** All user input (planned CC payments, ledger edits, starting-balance
  override) lives in `localStorage` under `hod.forecast.plan.v1`. The app stays read-only against Delta.
- **The app does no recurrence detection.** It only expands `gold.forecast_recurring` rows into dated
  events (`recurring.ts` → `expandRecurring`).

**Engine** (`forecast.ts`): events = expanded recurring items **+** planned CC payments; sorted by day
then income → outflow → CC within a day; one running balance feeds the KPIs, chart, and ledger so there
is exactly **one** balance calculation on the page. `dailyBalances()` carries the closing balance through
empty days; `computeWeeks()` carries it through empty weeks.

**Seed vs edits**: `stored.items === null` means "track the live seed" — the ledger re-derives from the
query on every gold refresh. **Any** ledger mutation materializes the array, so a nightly refresh can't
silently rewrite the user's edits. **Restore auto-detected** sets it back to `null` (drops to the live
seed) rather than snapshotting.

**CC payments are read-only in the ledger** ("· in planner") — the planner is their single source of
truth. Card balances/colors reuse `creditcards/cards.ts` (`cardShortName` / `cardInitials` were added
there for the planner chips).

**Ledger dot colors** follow the Spend ledger's per-**account** convention, NOT the group palette
(`dotColor()` in `ForecastLedger.tsx`): outflows are `--card-checking` (the same Ally purple the Spend ledger
uses for ··1871), each planned card payment carries its own `--card-*` token so it reads as the card it
pays across every tab, and **inflows are `--success`** (direction outranks account identity on the rows
holding the balance up — and their `group = 'Income'` has no `--group-*` token, so they'd otherwise fall
back to the same grey as "Other").

**Why "recurring only" is complete, not a gap** (confirmed by Edgar 2026-07-21): the ··1871 checking
account carries **only recurring payments + credit-card payments**. All day-to-day variable spend
(groceries, gas, restaurants) goes on the cards and reaches checking as the lump-sum CC payment, which
the planner models explicitly. So `gold.forecast_recurring` + planned CC payments is a *full* picture of
this account — the forecast is not systematically optimistic. Don't "fix" this by adding a variable-spend
allowance; it would double-count the card spend.

---

#### Tab 3 — Credit Cards — ✅ BUILT
**Queries**: `credit_card_monthly` (no params — returns the latest month via `WHERE month = (SELECT MAX(month) …)`)
+ `card_payments` (recent payments from `silver.transactions`, `category = 'Credit Card'` + `amount > 0` on
the 3 card accounts). Files: `app/client/src/pages/creditcards/` (`CreditCardsPage`, `BalanceHero`,
`CardWallet`, `PaymentsSection`, `ActivityTable`, `NetChip`, `cards.ts`, `types.ts`).

This tab is **point-in-time** (balances are the latest snapshot; activity is the current month), so it has
**no month selector and no Groups slicer** — it always shows the latest month, and the month label is derived
from the returned rows (`cards[0].month`).

Built with: a **Total Balance hero** (aggregate
balance, net-movement chip, by-card split bar, charges/payments/net for the month); a **card wallet** of 3
issuer-colored card faces (balance, `balance_as_of`, charges + net); a **Monthly Activity table** (Card ·
Charges · Payments · Net Activity · Txns · Balance); and a **Payments section** (per-card last-payment cards
+ a chronological recent-payments list from `card_payments`). Page order: hero → wallet → activity table →
payments.

**Net direction semantics:** `net_activity = charges − payments_received`; **negative (paid down) is good →
`--success`; positive (balance grew) → `--destructive`** (see `NetChip`/`netIsGood`). Card identity uses the
**real card brand colors** via the `--card-*` tokens — see the colors note under "Notes for Claude Code"
for the face-vs-mark split and why Southwest's mark is blue. Kept away from success/destructive, which
encode net direction. Card faces use white ink (`--card-ink`) on the dark brand fill.

---

#### Tab 4 — Budget vs Actual — ✅ BUILT
**Queries**: `budget_vs_actual` (per-month, param `budget_month`) + `budget_months` (distinct months for
the selector — added this session because the budget table's coverage differs from cashflow's history).
Files: `app/client/src/pages/budget/` (`BudgetPage`, `BudgetHealthHero`, `GroupSummaryCards`, `aggregate.ts`).

Built with: the shared page-wide **Group → Category hierarchy slicer** (`components/GroupCategorySlicer`,
also used by Cash Flow; filters by `excludedCategories`) + year>month selector; a **budget-health hero** (SVG donut of actual
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

#### Tab 5 — Spend Analysis — ✅ BUILT
**Queries**: `spend_transactions` (params `start_date`, `end_date` — the range-driven rows) + `spend_monthly`
(no params, fixed trailing-12-month aggregate for the Monthly Spend chart). The only tab that queries
`silver.transactions` directly. Files: `app/client/src/pages/spend/` (`SpendAnalysisPage`, `DateRangePicker`,
`FilterRail`, `SummaryStrip`, `MonthlySpendChart`, `SpendByCategoryChart`, `TopMerchants`, `TransactionLedger`,
`aggregate.ts`, `dateRange.ts`, `types.ts`).

Built with: header + **date-range picker** (Calendar-in-Popover with quick presets; default month-to-date,
drives the query params → re-fetch); a **collapsible filter rail** (Group / Category / Account checklists,
client-side over the fetched rows, default all-checked); a **summary strip** (Total Spend, Transactions,
Avg/Day, Top Category); a **Monthly Spend chart** (L12M stacked vertical bars, total label per bar, top-6
series + grey "Other", legend); a **Spend-by-Category chart** (horizontal bars, category/group `groupBy`
toggle, client-side); a **Top Merchants** table (top 6 by description, share bar, MoM vs the prior
equal-length period via a second `spend_transactions` query for the prior window); and a day-grouped
**Transaction Ledger** (capped at 300 rows, keyed by `transaction_id`).

The Monthly and Spend-by-Category charts **share one `breakdown` state** (category ↔ group) — either
dropdown flips both. The Monthly chart uses a **fixed trailing-12-month window** (not the date picker) but
**does honor the rail filters** (group/category/account) — `spend_monthly` carries `account_num` so all three
exclusions apply client-side (`filteredMonthlyRows`). Category-mode stacks use a rotating palette
(`MonthlySpendChart` `CAT_PALETTE`), group-mode uses the shared group colors, overflow beyond the top 6 →
"Other" (`#3a4048`). Each rail section (Group/Category/Account) has a tri-state **Select all / Clear** header
(via `useToggleSet`'s `setMany`), plus the global **Reset**.

**⚠️ `hide_from_reports` is on `silver.categories`, NOT `silver.transactions`** — the query LEFT JOINs
categories to respect the flag (`c.hide_from_reports = false OR IS NULL`). Expenses only: `amount < 0` and
`type != 'Transfer'`. Note: some internal transfers/savings moves are categorized with a non-`Transfer`
type (e.g. "Paycheck"/"Income" group with negative amounts) and will appear in the totals — users can
uncheck those groups in the rail. **Scope**: the query is limited to the joint checking account (1871) +
the 3 credit cards (1002/8957/4870) — see the `account_num IN (…)` filter.

**Colors**: the chart/merchants use group colors (shared `lib/groupColors.ts`, `--group-*` tokens, also used
by Budget/Credit Cards). The **Transaction Ledger dots are per-account** (`accountColor()` in
`spend/aggregate.ts`): the 3 cards reuse the Credit Cards `--card-*` tokens and checking uses
`--card-checking`.

---

## Repo structure

```
personal-budgeting/
├── CLAUDE.md                         ← this file
├── notebooks/
│   ├── nb_bronze_ingest_tiller.py
│   ├── nb_silver_transform_tiller.py
│   └── nb_gold__transform_tiller.sql   ← incl. gold.forecast_recurring (detection)
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

**All five tabs are built. The Forecast tab is built and verified locally but NOT yet deployed** —
run `databricks apps deploy -t default --profile personal-budgeting` from `app/`.

Remaining polish / follow-ups:

1. ~~Extend `tests/smoke.spec.ts` with assertions for each tab~~ — **done.** The suite now covers all
   five tabs structurally plus a Forecast interaction test. (Both original smoke tests had gone stale and
   were failing: one asserted the pre-branding `personal-budgeting` heading, the other asserted Credit
   Cards was "coming soon". Fixed.)
2. Consider codifying the UC grants (gold + silver `SELECT`/`USE SCHEMA` for the app SP) declaratively in
   `databricks.yml` — they're currently applied imperatively (see Notes), so a from-scratch recreate needs
   them re-run.
3. **Forecast follow-ups**: export/import the plan as JSON (localStorage backup / cross-device move);
   an optional user-set minimum-balance buffer line (only the $0 danger line ships today).
4. Optional: sortable columns on the ledger/merchants (reuse `SortableTableHead`); persist the Spend rail
   open/closed state to `localStorage`.

When adding a query: write the `.sql`, run `npm run typegen`, THEN write the UI against the generated types.
**Restart the dev server** so a NEW query registers (see Notes). Deploy: from `app/`,
`databricks apps deploy -t default --profile personal-budgeting`.

---

## Notes for Claude Code

- The SQL queries this app runs are against pre-aggregated Gold tables wherever possible.
  Only Tab 5 (Spend Analysis) queries `silver.transactions` directly. The Forecast tab reads
  `silver.balance_history` for its starting balance (`checking_balance`).
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
- **`npm run typegen` does NOT load `.env`** — only `npm run dev` does (`--env-file-if-exists`). Run bare,
  it can't see `DATABRICKS_CONFIG_PROFILE` and reports every new query as `OFFLINE / degraded` even with
  the warehouse RUNNING. Load the env first:
  `set -a && . ./.env && set +a && npx appkit generate-types`.
- **Keep the smoke suite honest.** It is the `apps validate` / deploy gate, but nothing re-runs it during
  normal dev, so assertions rot silently as the UI changes (two had been failing since the branding and
  Credit Cards work). Assertions should be **structural** — headings, section labels — never data-specific
  values, or a nightly gold refresh turns the deploy gate red.
- **Smoke test reuses an existing server** (`reuseExistingServer: true` in `playwright.config.ts`). If a
  stray dev server is already on `DATABRICKS_APP_PORT` (8000), `apps validate`/`deploy` tests THAT stale
  server instead of the fresh build → confusing failures. Kill strays on 8000 first, or run a local verify
  server on a different port (`DATABRICKS_APP_PORT=8001 npm run dev`).
- **Deploy = `databricks apps deploy -t default --profile personal-budgeting`** (validates → deploys →
  starts, returns the URL). Do NOT use bare `databricks bundle deploy` (creates the app with `no_compute`,
  stays stopped). `apps validate` runs the smoke test as a gate, so keep it green.
- **App SP needs UC `SELECT` + `USE SCHEMA` on every schema a query touches.** The workspace build runs
  `typegen --wait` (DESCRIBE QUERY) as the app's service principal — a missing grant fails the build with
  `INSUFFICIENT_PERMISSIONS`, not just at runtime. The SP (`1a8d86cb-…`) currently has `SELECT`+`USE SCHEMA`
  on `personal_budgeting.gold` **and** `personal_budgeting.silver` (granted imperatively via SQL, mirroring
  each other — not in `databricks.yml`). Any new schema a query reads needs the same grant first.
- **`hide_from_reports` lives on `silver.categories`, NOT `silver.transactions`.** To respect it when
  querying transactions directly, LEFT JOIN `silver.categories` on `category` and filter
  `c.hide_from_reports = false OR c.hide_from_reports IS NULL`. (See `spend_transactions.sql`.)
- **Shared group palette:** `client/src/lib/groupColors.ts` exports `GROUP_ORDER` / `GROUP_COLOR` /
  `groupColor` / `groupRank` (the `--group-*` tokens). Budget, Credit Cards, and Spend Analysis all import
  it — don't redefine the map per page.
- **Colors:** map semantic status to tokens (`--success` / `--warning` / `--destructive` /
  `--muted-foreground`). For categorical identity (e.g. the budget group palette) define dedicated tokens
  in `client/src/index.css` (we use `--group-*`) — do NOT reach for the shadcn `--chart-1..5` tokens for
  cross-theme identity: their hues differ between light and dark, so a series that looks right in one theme
  won't match a fixed design in the other.
- **Card colors are the REAL card brand colors, split into two roles** (`--card-*` in `index.css`,
  `cardColor()` vs `cardFaceColor()` in `creditcards/cards.ts`):
  - `--card-*-face` = the exact brand hex (Amex `#052c55`, Prime `#7d7877`, Southwest `#686f76`,
    Ally checking `#4b1256`). Large fills only — wallet card faces, planner initials chips.
    Theme-independent. **All four are dark**, so `--card-ink` is now `#ffffff` and the faces use
    white scrims (`bg-white/25`, `border-white/20`), not the black ones they had when the fills were vibrant.
  - `--card-*` (bare) = the MARK, for small elements (ledger dots, split bars, chart series). Same hue,
    **lightness-tuned per theme** — this is the one place a token legitimately differs between light and
    dark, because the true navy and purple sit at **1.33:1** on the dark surface and vanish as an 8px dot.
    Hue never moves, so identity holds.
  - **Southwest's MARK is the airline's blue, not its grey.** The real Southwest and Prime Visa plastics
    are both greys at **dE2000 8.2** — not separable as dots. The FACE keeps the true grey (identity there
    comes from the name + ··last4 anyway); only the mark diverges.
  - **Use dE2000, not contrast ratio, to judge categorical colors.** Contrast is lightness-only and will
    report two clearly different hues as a collision (it flagged the navy vs the purple at 1.01:1 when
    they are actually dE 20.2 apart). Current palette: every pair ≥ 15.5 dE, every mark ≥ 4.2:1 on its own
    theme surface, and nothing within 23 dE of success/destructive/warning — those encode net direction and
    must never read as card identity.
- **Known lint noise:** `shared/appkit-types/analytics.d.ts` (auto-generated, DO NOT EDIT) trips
  `no-unused-vars` on its marker imports, so `npm run lint` reports errors there regardless of your changes.
  `databricks apps validate` uses ast-grep lint (`appkit lint`), which passes — that's the gate that matters.
- **Verify UI changes for real** by driving the running app with the Playwright browser (a temp spec that
  navigates the route + screenshots) rather than trusting typecheck alone.
