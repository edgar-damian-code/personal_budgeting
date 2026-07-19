import { groupRank } from '../../lib/groupColors';
import type { SpendTransactionRow } from './types';

// Spend magnitude of a row (expenses are stored negative).
export function spendOf(row: SpendTransactionRow): number {
  return Math.abs(Number(row.amount));
}

export function totalSpend(rows: SpendTransactionRow[]): number {
  return rows.reduce((sum, r) => sum + spendOf(r), 0);
}

export type Bucket = { key: string; group: string; amount: number; count: number };

// Roll rows up by a key (category / group / merchant), summing spend, sorted desc.
// `group` on each bucket is the first-seen group, used only for the bar color.
export function bucketBy(rows: SpendTransactionRow[], keyOf: (r: SpendTransactionRow) => string): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of rows) {
    const key = keyOf(r);
    const b = m.get(key) ?? { key, group: r.group, amount: 0, count: 0 };
    b.amount += spendOf(r);
    b.count++;
    m.set(key, b);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

// Distinct filter options derived from the queried rows, so the checklists stay stable
// regardless of which client-side filters are currently applied.
export function distinctGroups(rows: SpendTransactionRow[]): string[] {
  return [...new Set(rows.map((r) => r.group))].sort((a, b) => groupRank(a) - groupRank(b));
}

export function distinctCategories(rows: SpendTransactionRow[]): string[] {
  return [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b));
}

// Accounts keyed by account_num (unique), labelled "Institution ··1234".
export function accountLabel(row: Pick<SpendTransactionRow, 'institution' | 'account_num'>): string {
  return `${row.institution} ··${row.account_num}`;
}

// One identity color per source account — the 3 credit cards reuse the Credit Cards tab's
// --card-* tokens; the joint checking account gets its own. Keyed by account_num.
const ACCOUNT_COLOR: Record<string, string> = {
  '1871': 'var(--card-checking)', // Ally joint checking
  '1002': 'var(--card-aspire)', // Amex Hilton Aspire
  '8957': 'var(--card-prime)', // Chase Prime Visa
  '4870': 'var(--card-southwest)', // Chase Southwest
};

export function accountColor(accountNum: string): string {
  return ACCOUNT_COLOR[accountNum] ?? 'var(--muted-foreground)';
}

export function distinctAccounts(rows: SpendTransactionRow[]): { key: string; label: string }[] {
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.account_num)) m.set(r.account_num, accountLabel(r));
  return [...m.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
