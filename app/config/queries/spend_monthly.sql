-- Monthly spend by category + group, trailing 12 months, for the Monthly Spend chart.
-- Fixed L12M window — NOT driven by the Spend Analysis date-range picker. Same scope/filters
-- as spend_transactions (checking 1871 + 3 cards, expenses only, no transfers, respect
-- hide_from_reports which lives on silver.categories). The client picks the stack key
-- (category vs group) from the shared breakdown toggle.
SELECT
  CAST(date_trunc('month', t.date) AS DATE) AS month,
  t.category,
  t.group,
  t.account_num,
  SUM(ABS(t.amount)) AS spend
FROM personal_budgeting.silver.transactions t
LEFT JOIN personal_budgeting.silver.categories c ON t.category = c.category
WHERE t.date >= date_trunc('month', current_date) - INTERVAL '11 months'
  AND t.type != 'Transfer'
  AND t.amount < 0
  AND (c.hide_from_reports = false OR c.hide_from_reports IS NULL)
  AND t.account_num IN ('1871', '1002', '8957', '4870')
GROUP BY 1, 2, 3, 4
ORDER BY 1;
