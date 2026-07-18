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
  GROUP BY month
)
SELECT
  month,
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
-- MAGIC ## Validation

-- COMMAND ----------

-- Row counts and date range per table
SELECT 'monthly_cashflow'         AS table_name, COUNT(*) AS rows, MIN(month)        AS earliest, MAX(month)        AS latest FROM personal_budgeting.gold.monthly_cashflow
UNION ALL
SELECT 'credit_card_monthly'      AS table_name, COUNT(*) AS rows, MIN(month)        AS earliest, MAX(month)        AS latest FROM personal_budgeting.gold.credit_card_monthly
UNION ALL
SELECT 'monthly_budget_vs_actual' AS table_name, COUNT(*) AS rows, MIN(budget_month) AS earliest, MAX(budget_month) AS latest FROM personal_budgeting.gold.monthly_budget_vs_actual

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