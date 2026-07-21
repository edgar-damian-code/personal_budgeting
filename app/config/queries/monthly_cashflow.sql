SELECT
  mc.month,
  mc.group,
  mc.category,
  c.type,
  mc.income,
  mc.outflows,
  mc.cc_payments,
  mc.fixed_outflows,
  mc.variable_outflows,
  mc.net_cashflow,
  mc.income_count,
  mc.outflow_count
FROM personal_budgeting.gold.monthly_cashflow mc
LEFT JOIN personal_budgeting.silver.categories c ON mc.category = c.category
-- Exclude internal transfers in/out of the 1871 checking account (savings moves,
-- account-to-account) — they aren't income or spend and badly distort the totals.
-- Keep 'Credit Card' payments: they're type=Transfer too, but represent real cash
-- leaving checking and have their own CC Payments bucket on the page.
WHERE COALESCE(c.type, '') <> 'Transfer' OR mc.category = 'Credit Card'
ORDER BY mc.month;
