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

// A group and its categories — the shape the Group → Category hierarchy slicer consumes.
export type GroupNode = { group: string; categories: string[] };

// Build the group → category tree from any rows carrying `group` + `category`. Groups are
// ordered by the canonical rank (Income/Transfer fall last); categories alphabetical.
export function buildGroupTree(rows: { group: string; category: string }[]): GroupNode[] {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.group)) map.set(r.group, new Set());
    map.get(r.group)!.add(r.category);
  }
  return [...map.entries()]
    .map(([group, cats]) => ({ group, categories: [...cats].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group));
}
