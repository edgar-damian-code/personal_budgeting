import type { BudgetVsActualRow } from '../cashflow/types';

// The 5 fixed category groups, in display order (mirrors the mockup / CLAUDE.md).
export const GROUP_ORDER = ['Living', 'Financial', 'Discretionary', 'Travel', 'Other'] as const;

// Categorical palette for the donut segments and group dots. Uses the dedicated
// --group-* identity tokens (defined in index.css, stable across light/dark) so each
// group keeps a consistent identity color matching the design mockup. NOT the --chart-*
// tokens — those shift hue between themes and can't match the mockup consistently.
export const GROUP_COLOR: Record<string, string> = {
  Living: 'var(--group-living)',
  Financial: 'var(--group-financial)',
  Discretionary: 'var(--group-discretionary)',
  Travel: 'var(--group-travel)',
  Other: 'var(--group-other)',
};

export function groupColor(group: string): string {
  return GROUP_COLOR[group] ?? 'var(--muted-foreground)';
}

function groupRank(group: string): number {
  const i = (GROUP_ORDER as readonly string[]).indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
}

export type BudgetStatus = 'success' | 'warning' | 'destructive' | 'muted';

// % of budget used → status. Mirrors BudgetBreakdownTable's pctBar thresholds:
// null (unbudgeted) → muted, >100 over → destructive, >=90 near → warning, else success.
export function pctStatus(pct: number | null): BudgetStatus {
  if (pct === null) return 'muted';
  if (pct > 100) return 'destructive';
  if (pct >= 90) return 'warning';
  return 'success';
}

export const STATUS_VAR: Record<BudgetStatus, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  muted: 'var(--muted-foreground)',
};

export const STATUS_TEXT_CLASS: Record<BudgetStatus, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
};

export const STATUS_BG_CLASS: Record<BudgetStatus, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground',
};

export type BudgetGroupSummary = {
  group: string;
  budget: number;
  actual: number;
  ytd: number;
  variance: number; // budget - actual (positive = under, negative = over)
  pct: number | null; // actual/budget * 100, null when budget is 0
  count: number;
  overCount: number;
  hasSpend: boolean;
};

export type CategoryVariance = { category: string; variance: number };

export type BudgetSummary = {
  totalBudget: number;
  totalActual: number;
  totalYtd: number;
  variance: number;
  pct: number | null;
  overCount: number;
  categoryCount: number;
  biggestOverage: CategoryVariance | null;
  biggestSaving: CategoryVariance | null;
  groups: BudgetGroupSummary[];
};

// Aggregate one month of budget_vs_actual rows into page-level totals + per-group
// roll-ups. Applies the same visibility rules everywhere (hide_from_reports and the
// page-wide Groups slicer) so the hero, donut, group cards, and table all agree.
// Rows with no budget AND no spend are dropped as noise — they'd only inflate counts.
export function summarizeBudget(rows: BudgetVsActualRow[], excludedGroups: Set<string>): BudgetSummary {
  const visible = rows.filter(
    (r) =>
      String(r.hide_from_reports) !== 'true' &&
      !excludedGroups.has(r.group) &&
      (Number(r.budgeted_amount) > 0 || Number(r.actual_amount) !== 0),
  );

  let totalBudget = 0;
  let totalActual = 0;
  let totalYtd = 0;
  let overCount = 0;
  let biggestOverage: CategoryVariance | null = null;
  let biggestSaving: CategoryVariance | null = null;
  const groupMap = new Map<string, BudgetGroupSummary>();

  for (const r of visible) {
    const budget = Number(r.budgeted_amount);
    const actual = Number(r.actual_amount);
    const ytd = Number(r.ytd_actual_amount);
    const variance = budget - actual;

    totalBudget += budget;
    totalActual += actual;
    totalYtd += ytd;
    if (actual > budget) overCount++;
    if (variance < 0 && (!biggestOverage || variance < biggestOverage.variance)) {
      biggestOverage = { category: r.category, variance };
    }
    if (variance > 0 && (!biggestSaving || variance > biggestSaving.variance)) {
      biggestSaving = { category: r.category, variance };
    }

    const g =
      groupMap.get(r.group) ??
      {
        group: r.group,
        budget: 0,
        actual: 0,
        ytd: 0,
        variance: 0,
        pct: null,
        count: 0,
        overCount: 0,
        hasSpend: false,
      };
    g.budget += budget;
    g.actual += actual;
    g.ytd += ytd;
    g.count++;
    if (actual > budget) g.overCount++;
    groupMap.set(r.group, g);
  }

  const groups = [...groupMap.values()]
    .map((g) => {
      g.variance = g.budget - g.actual;
      g.pct = g.budget > 0 ? (g.actual / g.budget) * 100 : null;
      g.hasSpend = g.actual !== 0;
      return g;
    })
    .sort((a, b) => groupRank(a.group) - groupRank(b.group));

  return {
    totalBudget,
    totalActual,
    totalYtd,
    variance: totalBudget - totalActual,
    pct: totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
    overCount,
    categoryCount: visible.length,
    biggestOverage,
    biggestSaving,
    groups,
  };
}

// Groups that appear in the data (before exclusion), ordered — feeds the Groups slicer
// so excluded groups still show as re-selectable options.
export function availableBudgetGroups(rows: BudgetVsActualRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (String(r.hide_from_reports) === 'true') continue;
    set.add(r.group);
  }
  return [...set].sort((a, b) => groupRank(a) - groupRank(b));
}
