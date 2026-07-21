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
  onToggleAll,
}: {
  title: string;
  options: Option[];
  excluded: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[], exclude: boolean) => void;
}) {
  if (options.length === 0) return null;
  const keys = options.map((o) => o.key);
  const excludedCount = keys.filter((k) => excluded.has(k)).length;
  const allExcluded = excludedCount === keys.length;
  const allSelected = excludedCount === 0;
  // Tri-state header = Select all / Clear. Clicking with anything excluded selects all;
  // clicking when everything is selected clears the whole section.
  const headerState = allSelected ? true : allExcluded ? false : 'indeterminate';
  return (
    <div className="mb-5">
      <label className="mb-2 flex cursor-pointer items-center gap-2.5">
        <Checkbox
          checked={headerState}
          onCheckedChange={() => onToggleAll(keys, allSelected)}
          aria-label={`Select all ${title}`}
        />
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</span>
        <span className="text-success ml-auto text-[11px] font-medium">{allSelected ? 'Clear' : 'Select all'}</span>
      </label>
      <div className="space-y-1.5 pl-6">
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
  onToggleAllGroups,
  onToggleAllCategories,
  onToggleAllAccounts,
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
  onToggleAllGroups: (keys: string[], exclude: boolean) => void;
  onToggleAllCategories: (keys: string[], exclude: boolean) => void;
  onToggleAllAccounts: (keys: string[], exclude: boolean) => void;
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
        onToggleAll={onToggleAllGroups}
      />
      <Section
        title="Category"
        options={categories.map((c) => ({ key: c, label: c }))}
        excluded={excludedCategories}
        onToggle={onToggleCategory}
        onToggleAll={onToggleAllCategories}
      />
      <Section
        title="Account"
        options={accounts}
        excluded={excludedAccounts}
        onToggle={onToggleAccount}
        onToggleAll={onToggleAllAccounts}
      />
    </div>
  );
}
