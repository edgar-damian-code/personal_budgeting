// The analytics endpoint returns every column as a JSON string (see the note in
// pages/cashflow/types.ts). Types reflect that with `number | string`; call sites coerce
// with Number() / String() rather than relying on the auto-generated result types.

// How a recurring item repeats. Detected in gold — see nb_gold__transform_tiller.sql.
//   monthly     -> posts on day_of_month
//   semimonthly -> posts on day_of_month (15) AND the last day of each month
//   biweekly    -> steps +/-14 days off anchor_date
export type Cadence = 'monthly' | 'semimonthly' | 'biweekly';

// One detected recurring inflow/outflow, from gold.forecast_recurring.
// `typical_amount` is a POSITIVE magnitude — the sign lives in `direction`.
export type RecurringRow = {
  description: string;
  category: string;
  group: string;
  direction: string; // 'in' | 'out'
  typical_amount: number | string;
  cadence: string; // Cadence
  day_of_month: number | string | null; // null for biweekly
  anchor_date: string | null; // null for monthly / semimonthly
  occurrence_count: number | string;
  months_present: number | string;
  last_seen: string;
  confidence: number | string;
  is_overridden: boolean | string; // TRUE when gold forced the cadence
};

// Latest balance snapshot for the 1871 checking account.
export type CheckingBalanceRow = {
  current_balance: number | string;
  balance_as_of: string;
};

// Direction of a ledger row. 'cc' is a planned card payment — always an outflow, and
// read-only in the ledger because the planner owns it.
export type FlowType = 'in' | 'out';

// A single user-planned credit-card payment.
export type PlannedPayment = {
  amt: number;
  date: string; // ISO yyyy-mm-dd
};

// Planned payments keyed by card account_num ('1002' | '8957' | '4870'). Keyed by
// account_num rather than a friendly id so it lines up with CARD_META and the query rows.
export type Plan = Record<string, PlannedPayment[]>;

// An editable forecast ledger row. Seeded by expandRecurring(), then owned by the user.
export type LedgerItem = {
  id: string;
  dateISO: string;
  desc: string;
  group: string;
  type: FlowType;
  amount: number; // positive magnitude; sign comes from `type`
};

// Everything the user can change, persisted to localStorage.
export type ForecastPlan = {
  startBal: number | null; // null -> fall back to the checking_balance query
  plan: Plan;
  items: LedgerItem[] | null; // null -> re-seed from forecast_recurring
};

// A dated, balance-resolved row in the forecast. Either an editable ledger item or a
// planned card payment (editable = false, owned by the planner).
export type ForecastEvent = {
  off: number; // day offset from the window start
  dateISO: string;
  desc: string;
  group: string;
  type: FlowType;
  sign: 1 | -1;
  amount: number;
  balAfter: number;
  editable: boolean;
  itemId?: string; // set when editable
  color?: string; // set for card payments (the --card-* token)
};

// One week of the forecast window (7 days), with its events and closing balance.
export type WeekBucket = {
  index: number;
  startISO: string;
  endISO: string;
  events: ForecastEvent[];
  net: number;
  endBalance: number;
  anyNegative: boolean;
};
