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
ORDER BY mc.month;
