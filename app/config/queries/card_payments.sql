-- Recent credit-card payments for the Payments section. gold.credit_card_monthly only has
-- a monthly payments_received total (no dates), so this reads silver.transactions directly.
-- CC payments appear on the CARD account as a POSITIVE amount, category = 'Credit Card'.
SELECT date, description, account, account_num, institution, amount
FROM personal_budgeting.silver.transactions
WHERE account_num IN ('1002', '8957', '4870')   -- the 3 credit cards
  AND amount > 0                                  -- payment received on the card
  AND category = 'Credit Card'                    -- CC payments carry category = 'Credit Card'
ORDER BY date DESC
LIMIT 12;
