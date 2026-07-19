import { useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { formatMonthLong, formatMonthOnly, currentMonthStart } from '../../lib/format';
import { GroupsSlicer } from '../cashflow/GroupsSlicer';
import { BudgetBreakdownTable } from '../cashflow/BudgetBreakdownTable';
import type { BudgetVsActualRow } from '../cashflow/types';
import { availableBudgetGroups, summarizeBudget } from './aggregate';
import { BudgetHealthHero } from './BudgetHealthHero';
import { GroupSummaryCards } from './GroupSummaryCards';

// The budget_months query result types as `unknown` until typegen runs against a live
// warehouse (it's offline-degraded when generated without a connection); shape it here.
type BudgetMonthRow = { budget_month: string };

export function BudgetPage() {
  const monthsParams = useMemo(() => ({}), []);
  const { data: monthsData, loading: monthsLoading, error: monthsError } = useAnalyticsQuery(
    'budget_months',
    monthsParams,
  );

  const months = useMemo(() => {
    const rows = (monthsData ?? []) as BudgetMonthRow[];
    return rows.map((r) => r.budget_month).sort((a, b) => a.localeCompare(b));
  }, [monthsData]);

  const defaultMonth = useMemo(() => {
    if (!months.length) return null;
    const todayMonth = currentMonthStart();
    return months.includes(todayMonth) ? todayMonth : months[months.length - 1];
  }, [months]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? defaultMonth;

  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(group: string) {
    setExcludedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const budgetParams = useMemo(() => ({ budget_month: sql.date(activeMonth ?? '1970-01-01') }), [activeMonth]);
  const { data: budgetData, loading: budgetLoading, error: budgetError } = useAnalyticsQuery(
    'budget_vs_actual',
    budgetParams,
  );

  const budgetRows = useMemo(() => (budgetData ?? []) as BudgetVsActualRow[], [budgetData]);

  const availableGroups = useMemo(() => availableBudgetGroups(budgetRows), [budgetRows]);
  const summary = useMemo(() => summarizeBudget(budgetRows, excludedGroups), [budgetRows, excludedGroups]);

  // Group months by year so the selector reads as a year > month picker (matches the
  // Cash Flow tab), even though budget data is a single year today.
  const monthsByYear = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const m of months) {
      const year = m.slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(m);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, ms]) => [year, [...ms].reverse()] as const);
  }, [months]);

  const hasSummary = summary.categoryCount > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Budget vs. Actual</h2>
          <p className="text-sm text-muted-foreground">
            Category spend against budget{activeMonth ? ` · ${formatMonthLong(activeMonth)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {availableGroups.length > 0 && (
            <GroupsSlicer groups={availableGroups} excluded={excludedGroups} onToggle={toggleGroup} />
          )}
          {months.length > 0 && (
            <Select value={activeMonth ?? undefined} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a month">
                  {activeMonth ? formatMonthLong(activeMonth) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthsByYear.map(([year, ms]) => (
                  <SelectGroup key={year}>
                    <SelectLabel>{year}</SelectLabel>
                    {ms.map((m) => (
                      <SelectItem key={m} value={m}>
                        {formatMonthOnly(m)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {(monthsError || budgetError) && (
        <Alert variant="destructive">
          <AlertTitle>Could not load budget data</AlertTitle>
          <AlertDescription>{monthsError ?? budgetError}</AlertDescription>
        </Alert>
      )}

      {(monthsLoading || budgetLoading) && !budgetError && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-40 flex-[1_1_380px]" />
            <Skeleton className="h-40 flex-[1_1_380px]" />
          </div>
          <div className="flex flex-wrap gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 flex-[1_1_200px]" />
            ))}
          </div>
        </div>
      )}

      {!monthsLoading && !budgetLoading && !monthsError && !budgetError && !hasSummary && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PieChart />
            </EmptyMedia>
            <EmptyTitle>No budget data{excludedGroups.size > 0 ? ' for this filter' : ' for this month'}</EmptyTitle>
            <EmptyDescription>
              {excludedGroups.size > 0
                ? 'Every group is excluded, or the remaining groups have no budget or spend. Adjust the Groups filter.'
                : 'No budgeted categories or spend recorded for this month yet.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!budgetLoading && !budgetError && hasSummary && activeMonth && (
        <>
          <BudgetHealthHero summary={summary} month={activeMonth} />
          <GroupSummaryCards groups={summary.groups} />
          <BudgetBreakdownTable
            data={budgetData as BudgetVsActualRow[] | null}
            loading={budgetLoading}
            error={budgetError}
            activeMonth={activeMonth}
            excludedGroups={excludedGroups}
          />
        </>
      )}
    </div>
  );
}
