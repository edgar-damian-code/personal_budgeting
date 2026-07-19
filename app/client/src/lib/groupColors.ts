// Shared category-group identity palette, used by the Budget, Credit Cards, and Spend
// Analysis tabs. Colors are the --group-* tokens defined in index.css (stable across
// light/dark) — decorative identity, NOT semantic status. See index.css for the values.

// The 5 fixed category groups, in display order.
export const GROUP_ORDER = ['Living', 'Financial', 'Discretionary', 'Travel', 'Other'] as const;

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

// Rank for sorting groups into the canonical order; unknown groups sort last.
export function groupRank(group: string): number {
  const i = (GROUP_ORDER as readonly string[]).indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
}
