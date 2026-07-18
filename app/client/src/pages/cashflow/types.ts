// The analytics endpoint returns every column — including BOOLEAN/DECIMAL/BIGINT — as a
// JSON string, not a native boolean/number (confirmed by inspecting the raw response).
// Types reflect that; call sites coerce explicitly rather than relying on truthiness
// (`!"false"` is `false` in JS, which would silently drop rows).

// One row per month + group + category from gold.monthly_cashflow, joined with
// silver.categories to bring in `type` (Income / Expense / Transfer) — the gold table
// itself doesn't carry it. `type` is null when a category has no match in
// silver.categories (shouldn't happen in practice, but LEFT JOIN allows for it).
export type MonthlyCashflowRow = {
  month: string;
  group: string;
  category: string;
  type: string | null;
  income: number | string;
  outflows: number | string;
  cc_payments: number | string;
  fixed_outflows: number | string;
  variable_outflows: number | string;
  net_cashflow: number | string;
  income_count: number | string;
  outflow_count: number | string;
};

// monthly_cashflow rows re-aggregated to one row per month (summed across category/group,
// after the Groups slicer filter is applied).
export type CashflowMonth = {
  month: string;
  income: number;
  outflows: number;
  cc_payments: number;
  fixed_outflows: number;
  variable_outflows: number;
  net_cashflow: number;
  income_count: number;
  outflow_count: number;
};

// monthly_cashflow rows re-aggregated to one row per month + category (summed across group
// members of that category — categories don't span groups in practice, but this keeps the
// aggregation honest either way).
export type CategoryMonth = {
  category: string;
  group: string;
  month: string;
  outflows: number;
};

export type BudgetVsActualRow = {
  budget_month: string;
  category: string;
  group: string;
  type: string;
  hide_from_reports: boolean | string;
  budgeted_amount: number | string;
  actual_amount: number | string;
  transaction_count: number | string;
  ytd_actual_amount: number | string;
  variance: number | string;
  pct_used: number | string | null;
};
