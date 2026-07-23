import { DEMO_ACCOUNT_ALIAS } from './demoAccounts';

// Client-side demo masking. When demo mode is on, lib/analyticsQuery.ts runs each
// query result through maskRows() before it reaches a page. The warehouse still runs
// the real query — this only rewrites the numbers/labels shown on screen, so the app
// stays read-only and no Databricks data changes. It is presentation masking, not a
// privacy boundary: real values still travel to the browser and are visible in the
// network tab. That is acceptable for the intended use — a quick over-the-shoulder
// demo, never a hand-off (see the demo-mode discussion in the project history).

// Each row is scaled by its OWN random-looking multiple of the real value, so the demo
// numbers look varied and organic rather than uniformly shifted. The factor is:
//   - deterministic (hashed from the row) → stable across re-renders, and the same for a
//     given card/category everywhere it appears, so tabs agree with each other;
//   - shared by every monetary field in the row → within a row the numbers still
//     reconcile (variance = budget - actual, pct_used, net totals all hold); only the
//     magnitude differs from reality, and it differs per row.
const MIN_FACTOR = 0.4;
const MAX_FACTOR = 2.6;

function rowFactor(row: Record<string, unknown>): number {
  const seed = hashString(JSON.stringify(row));
  return MIN_FACTOR + ((seed % 1000) / 1000) * (MAX_FACTOR - MIN_FACTOR);
}

const MERCHANTS = [
  'Riverbend Grocers', 'Northgate Fuel', 'Summit Coffee Co', 'Blue Fox Bistro',
  'Corner Hardware', 'Lumen Electric', 'Cedar Pharmacy', 'Metro Transit',
  'Harbor Books', 'Peak Outfitters', 'Golden Wok', 'Maple & Vine',
  'Bright Cleaners', 'Vista Cinemas', 'Orchard Market', 'Ironwood Grill',
  'Clearwater Utilities', 'Sunset Pizza', 'Trailhead Gear', 'Copperfield Cafe',
  'Willow Pet Supply', 'Anchor Auto Care', 'Nova Wireless', 'Fieldstone Bakery',
  'Union Barbershop', 'Evergreen Nursery', 'Lakeside Diner', 'Atlas Gym',
];

const INCOME_LABELS = [
  'Payroll Deposit', 'Northwind Payroll', 'Direct Deposit', 'Contract Payment',
  'Interest Earned', 'Reimbursement',
];

// Masking is driven off column names because every query shares the same conventions
// (see the data dictionary in CLAUDE.md).
const DESCRIPTION_KEY = /desc|description|merchant/i;
const ACCOUNT_KEY = /account_num/i;
// Identity / non-monetary numeric fields that must pass through untouched, or the UI
// breaks: cadence/day_of_month/anchor drive the forecast, counts and ids are structural,
// pct_used/confidence are already ratios. (account_num is handled separately — it is
// aliased to a fake last-4, not passed through.)
const PASSTHROUGH_KEY =
  /(_count$|_id$|(^|_)id$|month|date|_at$|day_of_month|pct_used|confidence|months_present|occurrence_count|anchor|last_seen)/i;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function looksLikeIncome(row: Record<string, unknown>): boolean {
  const group = String(row.group ?? '').toLowerCase();
  const type = String(row.type ?? '').toLowerCase();
  const direction = String(row.direction ?? '').toLowerCase();
  return direction === 'in' || type === 'income' || group === 'income' || group === 'paycheck';
}

// Deterministic: the same source label always maps to the same fake one, so a merchant
// reads consistently across every row and tab within a session.
function fakeLabel(original: string, row: Record<string, unknown>): string {
  const pool = looksLikeIncome(row) ? INCOME_LABELS : MERCHANTS;
  return pool[hashString(original) % pool.length];
}

function isNumericString(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

function maskValue(
  key: string,
  value: unknown,
  row: Record<string, unknown>,
  factor: number,
): unknown {
  if (value === null || value === undefined) return value;

  if (DESCRIPTION_KEY.test(key)) {
    return typeof value === 'string' && value.trim() !== '' ? fakeLabel(value, row) : value;
  }

  // Swap the real last-4 for its fixed demo alias; unknown numbers pass through.
  if (ACCOUNT_KEY.test(key)) {
    return typeof value === 'string' ? (DEMO_ACCOUNT_ALIAS[value] ?? value) : value;
  }

  if (PASSTHROUGH_KEY.test(key)) return value;

  // Scale monetary values by this row's factor. The analytics endpoint returns numbers
  // as strings, but handle native numbers too. Non-numeric strings (category, group,
  // account, institution, type, cadence, direction) fall through unchanged.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * factor * 100) / 100;
  }
  if (typeof value === 'string' && isNumericString(value)) {
    return (Math.round(Number(value) * factor * 100) / 100).toFixed(2);
  }
  return value;
}

function maskRow(row: unknown): unknown {
  if (row === null || typeof row !== 'object') return row;
  const source = row as Record<string, unknown>;
  const factor = rowFactor(source);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = maskValue(key, value, source, factor);
  }
  return out;
}

export function maskRows(rows: readonly unknown[]): unknown[] {
  return rows.map((row) => maskRow(row));
}
