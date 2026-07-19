// The analytics endpoint returns every column as a JSON string (see the note in
// pages/cashflow/types.ts). Types reflect that with `number | string`; call sites coerce
// with Number() rather than relying on the auto-generated `number` result types.

// One row per card for the selected month, from gold.credit_card_monthly.
// current_balance / balance_as_of are the latest snapshot (same regardless of month).
export type CreditCardMonthlyRow = {
  month: string;
  account: string;
  account_num: string;
  institution: string;
  charges: number | string;
  payments_received: number | string;
  net_activity: number | string; // charges - payments_received; negative = paid down (good)
  transaction_count: number | string;
  current_balance: number | string;
  balance_as_of: string;
};

// One payment applied to a card (silver.transactions, category = 'Credit Card', amount > 0).
export type CardPaymentRow = {
  date: string;
  description: string;
  account: string;
  account_num: string;
  institution: string;
  amount: number | string;
};
