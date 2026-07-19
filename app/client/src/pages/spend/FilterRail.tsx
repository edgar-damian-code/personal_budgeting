import { ChevronsLeft, ChevronsRight, SlidersHorizontal } from 'lucide-react';
import { Button, Checkbox } from '@databricks/appkit-ui/react';
import { groupColor } from '../../lib/groupColors';
import { formatRangeLabel } from './dateRange';
import type { IsoRange } from './types';

type Option = { key: string; label: string; dotColor?: string };

function Section({
  title,
  options,
  excluded,
  onToggle,
}: {
  title: string;
  options: Option[];
  excluded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">{title}</div>
      <div className="space-y-1.5">
        {options.map((o) => {
          const id = `${title}-${o.key}`;
          return (
            <label key={o.key} htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox id={id} checked={!excluded.has(o.key)} onCheckedChange={() => onToggle(o.key)} />
              {o.dotColor && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: o.dotColor }} />}
              <span className="truncate">{o.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function FilterRail({
  open,
  onToggleOpen,
  range,
  groups,
  categories,
  accounts,
  excludedGroups,
  excludedCategories,
  excludedAccounts,
  onToggleGroup,
  onToggleCategory,
  onToggleAccount,
  onReset,
  activeFilterCount,
}: {
  open: boolean;
  onToggleOpen: () => void;
  range: IsoRange;
  groups: string[];
  categories: string[];
  accounts: { key: string; label: string }[];
  excludedGroups: Set<string>;
  excludedCategories: Set<string>;
  excludedAccounts: Set<string>;
  onToggleGroup: (g: string) => void;
  onToggleCategory: (c: string) => void;
  onToggleAccount: (a: string) => void;
  onReset: () => void;
  activeFilterCount: number;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        title="Show filters"
        className="bg-card hover:bg-muted flex w-11 shrink-0 flex-col items-center gap-4 self-stretch rounded-xl border py-4 transition-colors"
      >
        <ChevronsRight className="text-success h-4 w-4" />
        <span className="text-muted-foreground text-xs font-semibold [writing-mode:vertical-rl]">
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </span>
      </button>
    );
  }

  return (
    <div className="bg-card w-64 shrink-0 rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-base font-semibold">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </span>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-success h-auto px-2 py-1" onClick={onReset}>
              Reset
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleOpen} title="Hide filters">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">Date range</div>
        <div className="bg-background text-foreground rounded-md border px-3 py-2 font-mono text-xs">
          {formatRangeLabel(range)}
        </div>
      </div>

      <Section
        title="Group"
        options={groups.map((g) => ({ key: g, label: g, dotColor: groupColor(g) }))}
        excluded={excludedGroups}
        onToggle={onToggleGroup}
      />
      <Section
        title="Category"
        options={categories.map((c) => ({ key: c, label: c }))}
        excluded={excludedCategories}
        onToggle={onToggleCategory}
      />
      <Section
        title="Account"
        options={accounts}
        excluded={excludedAccounts}
        onToggle={onToggleAccount}
      />
    </div>
  );
}
