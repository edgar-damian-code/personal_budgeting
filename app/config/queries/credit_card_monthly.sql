-- @param month DATE
-- Hero, card wallet, and monthly-activity table. One row per card per month.
-- current_balance / balance_as_of are the latest snapshot (same regardless of month).
SELECT
  month, account, account_num, institution,
  charges, payments_received, net_activity,
  transaction_count, current_balance, balance_as_of
FROM personal_budgeting.gold.credit_card_monthly
WHERE month = :month
ORDER BY current_balance DESC;
