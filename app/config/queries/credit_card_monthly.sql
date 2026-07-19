-- Hero, card wallet, and monthly-activity table. One row per card for the latest month.
-- The Credit Cards tab is point-in-time (balances are the latest snapshot, activity is the
-- current month), so this always returns the most recent month — no month selector.
-- current_balance / balance_as_of are the latest snapshot.
SELECT
  month, account, account_num, institution,
  charges, payments_received, net_activity,
  transaction_count, current_balance, balance_as_of
FROM personal_budgeting.gold.credit_card_monthly
WHERE month = (SELECT MAX(month) FROM personal_budgeting.gold.credit_card_monthly)
ORDER BY current_balance DESC;
