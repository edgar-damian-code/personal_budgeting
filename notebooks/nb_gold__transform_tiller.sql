-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Gold Transform: Tiller Financial Data
-- MAGIC
-- MAGIC Builds purpose-built aggregation tables to serve the Databricks App directly.
-- MAGIC Gold tables are designed around app views — not general-purpose aggregations.
-- MAGIC The app should do minimal calculation beyond filtering and display formatting.
-- MAGIC
-- MAGIC | Table | Serves | Grain |
-- MAGIC |---|---|---|
-- MAGIC | `gold.monthly_cashflow` | Cash Flow tab | One row per month |
-- MAGIC | `gold.credit_card_monthly` | Credit Cards tab | One row per card per month |
-- MAGIC | `gold.monthly_budget_vs_actual` | Spend Analysis tab | One row per category per month |
-- MAGIC | `gold.forecast_recurring` | Cash Flow Forecast tab | One row per detected recurring item |
-- MAGIC
-- MAGIC **Depends on:** `silver.transactions`, `silver.categories`, `silver.budget`, `silver.balance_history`
-- MAGIC
-- MAGIC ### Tiller amount conventions
-- MAGIC - Negative = expense / outflow (money leaving)
-- MAGIC - Positive = income / inflow (money arriving)
-- MAGIC - Credit card balances in `balance_history` are positive even though they are Liabilities

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## Setup

-- COMMAND ----------

CREATE SCHEMA IF NOT EXISTS personal_budgeting.gold

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## gold.monthly_cashflow
-- MAGIC
-- MAGIC Monthly summary of the joint checking account (Ally x1871).
-- MAGIC This is the primary cash position view — what came in, what went out, and what's left.
-- MAGIC
-- MAGIC **Scoped to account_num = '1871' only.**
-- MAGIC CC spend appears here only when the lump-sum card payment hits checking,
-- MAGIC which is the correct representation of cash leaving the account.
-- MAGIC
-- MAGIC ### Column definitions
-- MAGIC | Column | Definition |
-- MAGIC |---|---|
-- MAGIC | `income` | Sum of positive transactions (paychecks, transfers in) |
-- MAGIC | `outflows` | Sum of all negative transactions |
-- MAGIC | `cc_payments` | Subset of outflows: lump-sum credit card payments |
-- MAGIC | `fixed_outflows` | Subset of outflows: recurring fixed obligations (mortgage, cars, utilities, etc.) |
-- MAGIC | `variable_outflows` | outflows minus fixed_outflows minus cc_payments |
-- MAGIC | `net_cashflow` | income + outflows (outflows already negative) |

-- COMMAND ----------

CREATE OR REPLACE TABLE personal_budgeting.gold.monthly_cashflow AS
WITH base AS (
  SELECT
    month,
    group,
    category,
    -- Income: all positive amounts hitting the checking account
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,

    -- Outflows: all negative amounts leaving the checking account
    SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS outflows,

    -- CC payments: lump-sum payments to credit cards
    SUM(CASE WHEN category = 'Credit Card' AND amount < 0 THEN amount ELSE 0 END) AS cc_payments,

    -- Fixed outflows: recurring known obligations
    SUM(CASE
          WHEN amount < 0
          AND category IN (
            'Housing', 'Cars', 'Loan Repayment', 'Insurance',
            'Utilities and Bills', 'Subscriptions'
          )
          THEN amount ELSE 0
        END) AS fixed_outflows,

    COUNT(CASE WHEN amount > 0 THEN 1 END) AS income_count,
    COUNT(CASE WHEN amount < 0 THEN 1 END) AS outflow_count

  FROM personal_budgeting.silver.transactions
  WHERE account_num = '1871'
  GROUP BY month, group, category
)
SELECT
  month,
  group,
  category,
  income,
  outflows,
  cc_payments,
  fixed_outflows,
  -- variable_outflows: what's left after removing fixed obligations and CC payments
  outflows - fixed_outflows - cc_payments AS variable_outflows,
  -- net_cashflow: income + outflows — outflows already negative so this nets correctly
  income + outflows                       AS net_cashflow,
  income_count,
  outflow_count
FROM base
ORDER BY month

-- COMMAND ----------

-- Preview: most recent 3 months
SELECT *
FROM personal_budgeting.gold.monthly_cashflow
ORDER BY month DESC
LIMIT 3

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## gold.credit_card_monthly
-- MAGIC
-- MAGIC Monthly spend and payment activity per credit card, joined with the latest balance snapshot.
-- MAGIC Designed to answer: how much did we put on each card, how much did we pay, and what do we owe?
-- MAGIC
-- MAGIC ### Credit cards in scope
-- MAGIC | Card | Account # | Institution |
-- MAGIC |---|---|---|
-- MAGIC | Hilton Honors Aspire | 1002 | American Express |
-- MAGIC | Prime Visa | 8957 | Chase |
-- MAGIC | Southwest Rapid Rewards+ | 4870 | Chase |
-- MAGIC
-- MAGIC ### Latest balance strategy
-- MAGIC Balance History has multiple snapshots per account per day.
-- MAGIC `ROW_NUMBER() OVER (PARTITION BY account_num ORDER BY snapshot_at DESC)`
-- MAGIC selects the most recent snapshot using the `snapshot_at` timestamp built in Silver,
-- MAGIC which combines the raw date and time columns for accurate intraday ordering.
-- MAGIC
-- MAGIC ### Column definitions
-- MAGIC | Column | Definition |
-- MAGIC |---|---|
-- MAGIC | `charges` | Total spend on the card this month (shown as positive) |
-- MAGIC | `payments_received` | Payments applied to the card (positive amounts on the card) |
-- MAGIC | `net_activity` | charges - payments_received — net balance increase this month |
-- MAGIC | `current_balance` | Latest balance from balance_history |
-- MAGIC | `balance_as_of` | Date of the latest balance snapshot |

-- COMMAND ----------

CREATE OR REPLACE TABLE personal_budgeting.gold.credit_card_monthly AS
WITH latest_balances AS (
  -- Most recent balance snapshot per credit card account
  -- snapshot_at is a timestamp built in Silver from date + time columns
  -- ensuring accurate intraday ordering when multiple syncs happen per day
  SELECT
    account_num,
    balance        AS current_balance,
    date           AS balance_as_of,
    ROW_NUMBER() OVER (
      PARTITION BY account_num
      ORDER BY snapshot_at DESC
    ) AS rn
  FROM personal_budgeting.silver.balance_history
  WHERE class = 'Liability'   -- credit cards only
),

cc_activity AS (
  -- Monthly charges and payments per credit card account
  SELECT
    month,
    account,
    account_num,
    institution,
    -- Charges: Expense type transactions on the card
    -- Tiller records these as negative — ABS() for readable display
    ABS(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END)) AS charges,

    -- Payments received: positive amounts on the card (payment applied)
    SUM(CASE WHEN category = 'Credit Card' AND amount > 0 THEN amount ELSE 0 END) AS payments_received,

    COUNT(CASE WHEN type = 'Expense' THEN 1 END) AS transaction_count

  FROM personal_budgeting.silver.transactions
  WHERE account_num IN ('1002', '8957', '4870')  -- credit card accounts only
  GROUP BY month, account, account_num, institution
)

SELECT
  a.month,
  a.account,
  a.account_num,
  a.institution,
  a.charges,
  a.payments_received,
  a.charges - a.payments_received  AS net_activity,
  a.transaction_count,
  b.current_balance,
  b.balance_as_of
FROM cc_activity a
LEFT JOIN latest_balances b
  ON  a.account_num = b.account_num
  AND b.rn = 1
ORDER BY a.month DESC, a.account

-- COMMAND ----------

-- Preview: current month, all three cards
SELECT *
FROM personal_budgeting.gold.credit_card_monthly
WHERE month = DATE_TRUNC('month', CURRENT_DATE())
ORDER BY account

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## gold.monthly_budget_vs_actual
-- MAGIC
-- MAGIC Actual spending compared to budget for every Expense category, every month.
-- MAGIC Pre-computes variance and pct_used so the app does no arithmetic.
-- MAGIC
-- MAGIC ### Join strategy
-- MAGIC Start from `silver.budget` (all category/month combinations) and left join actuals.
-- MAGIC This ensures categories with a budget but no spend still appear with actual = 0 —
-- MAGIC meaningful data for the app (zero spend vs missing data).
-- MAGIC
-- MAGIC ### Column definitions
-- MAGIC | Column | Definition |
-- MAGIC |---|---|
-- MAGIC | `budgeted_amount` | Monthly budget (0 if not set) |
-- MAGIC | `actual_amount` | Absolute value of spending — positive for readability |
-- MAGIC | `variance` | budgeted - actual — positive = under budget, negative = over |
-- MAGIC | `pct_used` | actual / budget × 100 — NULL when budget = 0 (unbudgeted) |

-- COMMAND ----------

CREATE OR REPLACE TABLE personal_budgeting.gold.monthly_budget_vs_actual AS
WITH actuals AS (
  -- Actual spend per category per month
  -- Expense amounts are negative in Tiller — ABS() for clean variance math
  SELECT
    month,
    category,
    ABS(SUM(amount)) AS actual_amount,
    COUNT(*)         AS transaction_count
  FROM personal_budgeting.silver.transactions
  WHERE type = 'Expense'
  GROUP BY month, category
),
ytd_actuals AS (
  -- YTD actual spend per category
  -- First aggregate to month level, THEN apply window function
  SELECT
    category,
    month,
    SUM(monthly_actual) OVER (
      PARTITION BY category, YEAR(month)
      ORDER BY month
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ytd_actual_amount
  FROM (
    SELECT
      category,
      month,
      ABS(SUM(amount)) AS monthly_actual
    FROM personal_budgeting.silver.transactions
    WHERE type = 'Expense'
    GROUP BY category, month
  )
)

SELECT
  b.budget_month,
  b.category,
  c.group,
  c.type,
  c.hide_from_reports,
  b.budgeted_amount,
  COALESCE(a.actual_amount, 0)       AS actual_amount,
  COALESCE(a.transaction_count, 0)   AS transaction_count,

  -- YTD actual amount: sum of actuals from start of year to current month
  COALESCE(y.ytd_actual_amount, 0)   AS ytd_actual_amount,

  -- variance: positive = under budget, negative = over budget
  b.budgeted_amount - COALESCE(a.actual_amount, 0) AS variance,

  -- pct_used: NULL for unbudgeted categories to avoid division by zero
  -- app should render NULLs as "—" rather than a percentage
  CASE
    WHEN b.budgeted_amount > 0
    THEN ROUND((COALESCE(a.actual_amount, 0) / b.budgeted_amount) * 100, 1)
    ELSE NULL
  END AS pct_used

FROM personal_budgeting.silver.budget b
LEFT JOIN personal_budgeting.silver.categories c
  ON b.category = c.category
LEFT JOIN actuals a
  ON  b.category    = a.category
  AND b.budget_month = a.month
LEFT JOIN ytd_actuals y
  ON  b.category = y.category
  AND b.budget_month = y.month
WHERE c.type = 'Expense'
ORDER BY b.budget_month, c.group, b.category

-- COMMAND ----------

-- Preview: current month, budgeted categories only
SELECT *
FROM personal_budgeting.gold.monthly_budget_vs_actual
WHERE budget_month = DATE_TRUNC('month', CURRENT_DATE())
  AND budgeted_amount > 0
ORDER BY group, category

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## gold.forecast_recurring
-- MAGIC
-- MAGIC One row per detected **recurring** inflow/outflow on the joint checking account (Ally x1871).
-- MAGIC Seeds the Cash Flow Forecast tab. Detection runs **here**, in gold — never in the app.
-- MAGIC
-- MAGIC We deliberately do NOT copy `silver.transactions` into gold. We materialize the recurring
-- MAGIC *signals* (~10–15 rows) — "the things that repeat" — not the raw ledger.
-- MAGIC
-- MAGIC ### Detection heuristic (intentionally simple — low volume account)
-- MAGIC Group by category + merchant over the **last 6 completed months**, then:
-- MAGIC - keep anything present in **>= 3** of those months ("recurring")
-- MAGIC - drop trivial noise (`typical_amount < 20`)
-- MAGIC - `typical_amount` = **median** absolute amount; `day_of_month` = **median** day-of-month
-- MAGIC - classify cadence (see below)
-- MAGIC
-- MAGIC The app's **editable ledger is the safety valve** for anything detection gets wrong.
-- MAGIC
-- MAGIC ### Merchant aliasing
-- MAGIC Tiller descriptions **drift over time**. The employer payroll description changed mid-March 2026
-- MAGIC (`C100279 Eisen in Dir Dep` -> `C100279 Eisen in Payroll`), which split one biweekly stream into
-- MAGIC two half-confidence rows. The `merchant` CASE block in `scope` collapses known aliases back into a
-- MAGIC single stream. **Add a line here whenever a description drifts.**
-- MAGIC
-- MAGIC ### Cadence classification
-- MAGIC Average gap alone can't separate biweekly (~14d) from semi-monthly (~15.2d), so we fingerprint
-- MAGIC **where in the month** the hits land:
-- MAGIC
-- MAGIC | Cadence | Test | Expansion in the app |
-- MAGIC |---|---|---|
-- MAGIC | `semimonthly` | gap <= 18d **and** >= 80% of hits fall on the 15th (14-16) or the last day (>= 28, or the 1st) | post on the **15th and the last day** of each month |
-- MAGIC | `biweekly` | gap <= 18d, hits scattered across the month | step **+14 days** off `anchor_date` |
-- MAGIC | `monthly` | gap > 18d | post on `day_of_month` |
-- MAGIC
-- MAGIC ### Schedule overrides
-- MAGIC Detection describes the **past**. When a schedule changes going forward, no heuristic can see
-- MAGIC it — the history is genuinely biweekly right up until it isn't. The `schedule_overrides` CTE
-- MAGIC is the escape hatch: a description -> cadence pair that wins over the detected cadence.
-- MAGIC
-- MAGIC Currently overridden:
-- MAGIC - `Requested Transfer (Ally x4072)` — biweekly -> **semimonthly** (moving to the 15th + last day)
-- MAGIC
-- MAGIC **Remove an override once ~3 months of actuals exist under the new schedule** — detection will
-- MAGIC then classify it correctly on its own, and a stale override would start fighting the data.
-- MAGIC The `is_overridden` flag is carried through so the app can label these rows.
-- MAGIC
-- MAGIC ### Anchor freshness
-- MAGIC Detection stats use completed months only (a partial current month would drag `months_present`
-- MAGIC and the cadence around), but `anchor_date` / `last_seen` come from the newest **actual**
-- MAGIC occurrence **including the current month**. A biweekly anchor taken from the last completed
-- MAGIC month can be up to 7 weeks stale, and every `+14` step inherits that error.
-- MAGIC
-- MAGIC ### Exclusions
-- MAGIC - `type = 'Transfer'` — internal moves between own accounts
-- MAGIC - `category = 'Credit Card'` — CC payments are **user-planned** in the app, not forecast
-- MAGIC - `hide_from_reports` categories
-- MAGIC
-- MAGIC ### Column definitions
-- MAGIC | Column | Definition |
-- MAGIC |---|---|
-- MAGIC | `description` | Merchant / label (aliased — see above) |
-- MAGIC | `direction` | `'in'` or `'out'` — sign lives here, not in the amount |
-- MAGIC | `typical_amount` | **Positive magnitude** (median) |
-- MAGIC | `cadence` | `'monthly'`, `'biweekly'`, or `'semimonthly'` |
-- MAGIC | `day_of_month` | monthly -> median day; semimonthly -> `15` (app also posts EOM); biweekly -> NULL |
-- MAGIC | `anchor_date` | set for biweekly (step +14 days); NULL otherwise |
-- MAGIC | `is_overridden` | TRUE when `schedule_overrides` replaced the detected cadence |
-- MAGIC | `occurrence_count`, `months_present`, `last_seen`, `confidence` | diagnostics |

-- COMMAND ----------

CREATE OR REPLACE TABLE personal_budgeting.gold.forecast_recurring AS
WITH scope AS (
  SELECT
    t.date,
    t.month,
    t.category,
    c.group,
    -- Merchant aliasing. Tiller descriptions drift; without this the same recurring
    -- stream splits into two half-confidence rows. Add a line per known drift.
    CASE
      -- Employer payroll: description changed mid-March 2026
      -- ('C100279 Eisen in Dir Dep' -> 'C100279 Eisen in Payroll'). One biweekly stream.
      WHEN t.description ILIKE '%Eisen%'                      THEN 'Eisen Payroll'
      -- Recurring inbound transfer from the other checking account (x4072)
      WHEN t.description ILIKE 'Requested transfer from Ally%' THEN 'Requested Transfer (Ally x4072)'
      -- Electric bill embeds the amount in the description
      -- ('Evergy Metro Autopay~ Future Amount: 280 ~ Tran: Achdw') -- it will split
      -- this row the first month the bill changes. Collapse to the stable prefix.
      WHEN t.description ILIKE 'Evergy%'                      THEN 'Evergy Metro Autopay'
      ELSE t.description
    END           AS merchant,
    t.amount,
    DAY(t.date)   AS dom
  FROM personal_budgeting.silver.transactions t
  LEFT JOIN personal_budgeting.silver.categories c
    ON t.category = c.category
  WHERE t.account_num = '1871'
    AND COALESCE(t.type, '')     <> 'Transfer'     -- internal moves (also drops CC payments)
    AND COALESCE(t.category, '') <> 'Credit Card'  -- CC payments are user-planned in the app
    AND COALESCE(c.hide_from_reports, FALSE) = FALSE
    AND t.month >= ADD_MONTHS(DATE_TRUNC('month', CURRENT_DATE()), -6)
    -- NOTE: no upper month bound here on purpose -- `recent` needs the current month
),
detect AS (
  -- Detection stats use COMPLETED months only, so a partial current month never
  -- drags months_present / cadence / the median amount around.
  SELECT *
  FROM scope
  WHERE month < DATE_TRUNC('month', CURRENT_DATE())
),
grouped AS (
  SELECT
    category,
    group,
    merchant,
    COUNT(*)                                                        AS occurrence_count,
    COUNT(DISTINCT month)                                           AS months_present,
    AVG(amount)                                                     AS avg_amount,
    MEDIAN(ABS(amount))                                             AS typical_amount,
    MEDIAN(dom)                                                     AS median_dom,
    (DATEDIFF(MAX(date), MIN(date)) * 1.0) / NULLIF(COUNT(*) - 1, 0) AS avg_gap_days,
    -- Semi-monthly fingerprint: hits cluster on the 15th and the last day of the
    -- month. Average gap alone can't separate this (~15.2d) from biweekly (~14d).
    COUNT_IF(dom BETWEEN 14 AND 16)                                 AS mid_month_hits,
    COUNT_IF(dom >= 28 OR dom <= 1)                                 AS eom_hits
  FROM detect
  GROUP BY category, group, merchant
),
recent AS (
  -- Anchor off the newest ACTUAL occurrence, current month INCLUDED. A biweekly
  -- anchor taken from the last completed month can be up to 7 weeks stale, and
  -- every +14 step inherits that error.
  SELECT category, group, merchant, MAX(date) AS last_seen
  FROM scope
  GROUP BY category, group, merchant
),
classified AS (
  SELECT
    g.*,
    r.last_seen,
    CASE
      WHEN g.avg_gap_days <= 18
       AND (g.mid_month_hits + g.eom_hits) >= 0.8 * g.occurrence_count THEN 'semimonthly'
      WHEN g.avg_gap_days <= 18                                        THEN 'biweekly'
      ELSE                                                                  'monthly'
    END AS cadence
  FROM grouped g
  JOIN recent r
    ON  g.category = r.category
    AND g.merchant = r.merchant
    AND COALESCE(g.group, '') = COALESCE(r.group, '')
),
schedule_overrides AS (
  -- Known FORWARD-LOOKING schedule changes. Detection describes the past; these
  -- describe a change already made or scheduled, which no amount of history can
  -- predict. Keyed on the aliased description. Remove a row once ~3 months of
  -- actuals exist under the new schedule -- detection will then find it on its own.
  SELECT * FROM VALUES
    -- Moving from biweekly to the 15th + last day of the month (confirmed 2026-07-21)
    ('Requested Transfer (Ally x4072)', 'semimonthly')
  AS o(description, cadence)
),
resolved AS (
  SELECT
    c.*,
    COALESCE(o.cadence, c.cadence) AS final_cadence,
    o.cadence IS NOT NULL          AS is_overridden
  FROM classified c
  LEFT JOIN schedule_overrides o
    ON c.merchant = o.description
)
SELECT
  merchant                                                          AS description,
  category,
  group,
  CASE WHEN avg_amount > 0 THEN 'in' ELSE 'out' END                 AS direction,
  ROUND(typical_amount, 2)                                          AS typical_amount,
  final_cadence                                                     AS cadence,
  CASE final_cadence
    WHEN 'monthly'     THEN CAST(ROUND(median_dom) AS INT)
    WHEN 'semimonthly' THEN 15    -- the app posts the 15th AND the last day
    ELSE NULL                     -- biweekly steps off anchor_date
  END                                                               AS day_of_month,
  CASE WHEN final_cadence = 'biweekly' THEN last_seen ELSE NULL END AS anchor_date,
  occurrence_count,
  months_present,
  last_seen,
  ROUND(months_present / 6.0, 2)                                    AS confidence,
  is_overridden
FROM resolved
WHERE months_present >= 3     -- present in at least half of the last 6 months -> "recurring"
  AND typical_amount >= 20    -- ignore trivial noise
ORDER BY direction DESC, typical_amount DESC

-- COMMAND ----------

-- Preview: everything detected, inflows first
SELECT *
FROM personal_budgeting.gold.forecast_recurring
ORDER BY direction DESC, typical_amount DESC

-- COMMAND ----------

-- MAGIC %md
-- MAGIC ## Validation

-- COMMAND ----------

-- Row counts and date range per table
SELECT 'monthly_cashflow'         AS table_name, COUNT(*) AS rows, MIN(month)        AS earliest, MAX(month)        AS latest FROM personal_budgeting.gold.monthly_cashflow
UNION ALL
SELECT 'credit_card_monthly'      AS table_name, COUNT(*) AS rows, MIN(month)        AS earliest, MAX(month)        AS latest FROM personal_budgeting.gold.credit_card_monthly
UNION ALL
SELECT 'monthly_budget_vs_actual' AS table_name, COUNT(*) AS rows, MIN(budget_month) AS earliest, MAX(budget_month) AS latest FROM personal_budgeting.gold.monthly_budget_vs_actual
UNION ALL
SELECT 'forecast_recurring'       AS table_name, COUNT(*) AS rows, MIN(last_seen)    AS earliest, MAX(last_seen)    AS latest FROM personal_budgeting.gold.forecast_recurring

-- COMMAND ----------

-- Current month cashflow summary
SELECT *
FROM personal_budgeting.gold.monthly_cashflow
WHERE month = DATE_TRUNC('month', CURRENT_DATE())

-- COMMAND ----------

-- Over-budget categories this month
SELECT
  category,
  group,
  budgeted_amount,
  actual_amount,
  variance,
  pct_used
FROM personal_budgeting.gold.monthly_budget_vs_actual
WHERE budget_month  = DATE_TRUNC('month', CURRENT_DATE())
  AND budgeted_amount > 0
  AND actual_amount > budgeted_amount
ORDER BY variance ASC