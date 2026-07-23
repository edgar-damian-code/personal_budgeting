import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { useAnalyticsQuery } from '../../lib/analyticsQuery';
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
  Skeleton,
} from '@databricks/appkit-ui/react';
import { DateRangePicker } from './DateRangePicker';
import { FilterRail } from './FilterRail';
import { SummaryStrip } from './SummaryStrip';
import { MonthlySpendChart } from './MonthlySpendChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { TopMerchants } from './TopMerchants';
import { TransactionLedger } from './TransactionLedger';
import { distinctAccounts, distinctCategories, distinctGroups } from './aggregate';
import { currentMonthToDate, priorRange } from './dateRange';
import type { Breakdown, IsoRange, SpendMonthlyRow, SpendTransactionRow } from './types';

function useToggleSet() {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Bulk include/exclude — powers the per-section "Select all" / "Clear".
  const setMany = (keys: string[], exclude: boolean) =>
    setSet((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (exclude) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  const reset = () => setSet(new Set());
  return [set, toggle, reset, setMany] as const;
}

export function SpendAnalysisPage() {
  const [range, setRange] = useState<IsoRange>(() => currentMonthToDate());
  const [railOpen, setRailOpen] = useState(true);
  const [breakdown, setBreakdown] = useState<Breakdown>('category');

  const [excludedGroups, toggleGroup, resetGroups, setGroups] = useToggleSet();
  const [excludedCategories, toggleCategory, resetCategories, setCategories] = useToggleSet();
  const [excludedAccounts, toggleAccount, resetAccounts, setAccounts] = useToggleSet();

  const currentParams = useMemo(
    () => ({ start_date: sql.date(range.start), end_date: sql.date(range.end) }),
    [range],
  );
  const { data, loading, error } = useAnalyticsQuery('spend_transactions', currentParams);
  const rows = useMemo(() => (data ?? []) as SpendTransactionRow[], [data]);

  // Prior equal-length window, for the Top Merchants MoM comparison.
  const priorParams = useMemo(() => {
    const p = priorRange(range);
    return { start_date: sql.date(p.start), end_date: sql.date(p.end) };
  }, [range]);
  const { data: priorData } = useAnalyticsQuery('spend_transactions', priorParams);
  const priorRows = useMemo(() => (priorData ?? []) as SpendTransactionRow[], [priorData]);

  // Monthly Spend chart: its own fixed trailing-12-month window (independent of the date
  // picker) but it DOES honor the client-side rail filters below.
  const noParams = useMemo(() => ({}), []);
  const { data: monthlyData } = useAnalyticsQuery('spend_monthly', noParams);
  const monthlyRows = useMemo(() => (monthlyData ?? []) as SpendMonthlyRow[], [monthlyData]);

  const groups = useMemo(() => distinctGroups(rows), [rows]);
  const categories = useMemo(() => distinctCategories(rows), [rows]);
  const accounts = useMemo(() => distinctAccounts(rows), [rows]);

  // Inlined (not a shared `keep` closure) so the memo dependencies are the excluded sets
  // themselves — keeps the React Compiler's memoization intact.
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !excludedGroups.has(r.group) &&
          !excludedCategories.has(r.category) &&
          !excludedAccounts.has(r.account_num),
      ),
    [rows, excludedGroups, excludedCategories, excludedAccounts],
  );
  const filteredPriorRows = useMemo(
    () =>
      priorRows.filter(
        (r) =>
          !excludedGroups.has(r.group) &&
          !excludedCategories.has(r.category) &&
          !excludedAccounts.has(r.account_num),
      ),
    [priorRows, excludedGroups, excludedCategories, excludedAccounts],
  );
  const filteredMonthlyRows = useMemo(
    () =>
      monthlyRows.filter(
        (r) =>
          !excludedGroups.has(r.group) &&
          !excludedCategories.has(r.category) &&
          !excludedAccounts.has(r.account_num),
      ),
    [monthlyRows, excludedGroups, excludedCategories, excludedAccounts],
  );

  const activeFilterCount = excludedGroups.size + excludedCategories.size + excludedAccounts.size;
  const resetAll = () => {
    resetGroups();
    resetCategories();
    resetAccounts();
  };

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Spend Analysis</h2>
          <p className="text-sm text-muted-foreground">Transaction-level exploration · excludes transfers</p>
        </div>
        <DateRangePicker range={range} onChange={setRange} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load transactions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && (
        <div className="flex items-start gap-5">
          <FilterRail
            open={railOpen}
            onToggleOpen={() => setRailOpen((o) => !o)}
            range={range}
            groups={groups}
            categories={categories}
            accounts={accounts}
            excludedGroups={excludedGroups}
            excludedCategories={excludedCategories}
            excludedAccounts={excludedAccounts}
            onToggleGroup={toggleGroup}
            onToggleCategory={toggleCategory}
            onToggleAccount={toggleAccount}
            onToggleAllGroups={setGroups}
            onToggleAllCategories={setCategories}
            onToggleAllAccounts={setAccounts}
            onReset={resetAll}
            activeFilterCount={activeFilterCount}
          />

          <div className="min-w-0 flex-1 space-y-5">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-80 w-full" />
              </>
            ) : rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Receipt />
                  </EmptyMedia>
                  <EmptyTitle>No spend in this date range</EmptyTitle>
                  <EmptyDescription>
                    No non-transfer expenses between the selected dates. Try a wider range.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <SummaryStrip rows={filteredRows} range={range} />
                <MonthlySpendChart rows={filteredMonthlyRows} breakdown={breakdown} onBreakdownChange={setBreakdown} />
                <SpendByCategoryChart rows={filteredRows} breakdown={breakdown} onBreakdownChange={setBreakdown} />
                <TopMerchants rows={filteredRows} priorRows={filteredPriorRows} />
                <TransactionLedger rows={filteredRows} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
