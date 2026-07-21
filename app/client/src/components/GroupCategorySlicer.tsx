import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@databricks/appkit-ui/react';
import { groupColor, type GroupNode } from '../lib/groupColors';

// Group → Category hierarchy filter. State is a single `excludedCategories` set: the group
// checkbox is derived (checked / indeterminate / unchecked) and toggling it flips all of the
// group's categories at once. Excluding a whole group == excluding all its categories.
export function GroupCategorySlicer({
  tree,
  excludedCategories,
  onToggleCategory,
  onToggleGroup,
  onReset,
}: {
  tree: GroupNode[];
  excludedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onToggleGroup: (categories: string[], exclude: boolean) => void;
  onReset: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleCollapse(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const totalCats = tree.reduce((sum, n) => sum + n.categories.length, 0);
  const excludedCount = tree.reduce((sum, n) => sum + n.categories.filter((c) => excludedCategories.has(c)).length, 0);
  const label = excludedCount === 0 ? 'All' : `${totalCats - excludedCount} of ${totalCats}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="text-muted-foreground text-xs font-normal">Groups</span>
          <span>{label}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div>
            <div className="text-sm font-medium">Filter</div>
            <div className="text-muted-foreground text-xs">Groups & categories · whole page</div>
          </div>
          {excludedCount > 0 && (
            <Button variant="ghost" size="sm" className="text-success h-auto px-2 py-1" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {tree.map(({ group, categories }) => {
            const excludedInGroup = categories.filter((c) => excludedCategories.has(c)).length;
            const allExcluded = excludedInGroup === categories.length;
            const groupState = excludedInGroup === 0 ? true : allExcluded ? false : 'indeterminate';
            const isCollapsed = collapsed.has(group);
            return (
              <div key={group}>
                <div className="hover:bg-muted flex items-center gap-2 rounded-md px-1.5 py-1.5">
                  <Checkbox
                    checked={groupState}
                    onCheckedChange={() => onToggleGroup(categories, !allExcluded)}
                    aria-label={`Toggle ${group}`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: groupColor(group) }} />
                    <span className="text-sm font-medium">{group}</span>
                    <ChevronRight
                      className={`text-muted-foreground ml-auto h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    />
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="mb-1 ml-6 flex flex-col">
                    {categories.map((cat) => {
                      const id = `${group}-${cat}`;
                      return (
                        <label
                          key={cat}
                          htmlFor={id}
                          className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm"
                        >
                          <Checkbox
                            id={id}
                            checked={!excludedCategories.has(cat)}
                            onCheckedChange={() => onToggleCategory(cat)}
                          />
                          <span className="truncate">{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
