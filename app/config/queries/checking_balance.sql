-- Cash Flow Forecast tab: starting balance ("balance today") for the 1871 checking account.
-- Latest snapshot by snapshot_at (same latest-snapshot pattern as credit_card_monthly).
-- The user can override this in the UI (persisted to localStorage); this value is the
-- default and the reset target.
SELECT balance AS current_balance, date AS balance_as_of
FROM personal_budgeting.silver.balance_history
WHERE account_num = '1871'
ORDER BY snapshot_at DESC
LIMIT 1;
