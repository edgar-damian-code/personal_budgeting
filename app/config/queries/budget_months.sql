-- Distinct months present in the budget table, for the Budget vs Actual month selector.
-- The budget table's coverage (Jan–Dec of the budgeted year) differs from
-- monthly_cashflow's history, so the month list is sourced from the budget table itself.
SELECT DISTINCT budget_month
FROM personal_budgeting.gold.monthly_budget_vs_actual
ORDER BY budget_month;
