-- @param start_date DATE
-- @param end_date DATE
-- Transaction-level spend for the Spend Analysis tab. Queries silver.transactions directly
-- (the only tab that does) because its filtering can't be pre-aggregated.
-- Expenses only: amount < 0 (outflows), excluding transfers/CC payments.
-- hide_from_reports lives on silver.categories (not transactions), so join to respect it.
SELECT t.transaction_id, t.date, t.description, t.category, t.group, t.account, t.account_num, t.institution, t.amount, t.type
FROM personal_budgeting.silver.transactions t
LEFT JOIN personal_budgeting.silver.categories c ON t.category = c.category
WHERE t.date BETWEEN :start_date AND :end_date
  AND t.account_num IN ('1871', '1002', '8957', '4870')    -- joint checking + the 3 credit cards only
  AND t.type != 'Transfer'                                  -- exclude internal moves / CC payments
  AND t.amount < 0                                          -- expenses only (income out of scope)
  AND (c.hide_from_reports = false OR c.hide_from_reports IS NULL)  -- respect the report-hide flag
ORDER BY t.date DESC;
