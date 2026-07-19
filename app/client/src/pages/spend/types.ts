// Expense rows from silver.transactions (amount < 0). The analytics endpoint returns
// numbers/booleans as strings (see pages/cashflow/types.ts) — coerce with Number().
export type SpendTransactionRow = {
  transaction_id: string;
  date: string;
  description: string;
  category: string;
  group: string;
  account: string;
  account_num: string;
  institution: string;
  amount: number | string; // negative = expense
  type: string;
};

// Inclusive date range as 'YYYY-MM-DD' strings (kept as strings to feed sql.date()).
export type IsoRange = { start: string; end: string };
