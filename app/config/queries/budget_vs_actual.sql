-- @param budget_month DATE
SELECT *
FROM personal_budgeting.gold.monthly_budget_vs_actual
WHERE budget_month = :budget_month
ORDER BY actual_amount DESC;
