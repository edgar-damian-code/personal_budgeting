import { Card, CardDescription, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { formatCurrencyCents } from '../../lib/format';
import { accountColor, accountLabel, spendOf, totalSpend } from './aggregate';
import { fromIsoDate } from './dateRange';
import type { SpendTransactionRow } from './types';

const MAX_ROWS = 300;

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type DayGroup = { date: string; rows: SpendTransactionRow[]; total: number };

// Group rows into day blocks, preserving the incoming (date-desc) order.
function groupByDay(rows: SpendTransactionRow[]): DayGroup[] {
  const days: DayGroup[] = [];
  const indexByDate = new Map<string, number>();
  for (const r of rows) {
    let i = indexByDate.get(r.date);
    if (i === undefined) {
      i = days.length;
      indexByDate.set(r.date, i);
      days.push({ date: r.date, rows: [], total: 0 });
    }
    days[i].rows.push(r);
    days[i].total += spendOf(r);
  }
  return days;
}

export function TransactionLedger({ rows }: { rows: SpendTransactionRow[] }) {
  const total = totalSpend(rows);
  const capped = rows.length > MAX_ROWS;
  const shownRows = capped ? rows.slice(0, MAX_ROWS) : rows;
  const days = groupByDay(shownRows);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-baseline justify-between py-5">
        <div>
          <CardTitle>Transaction Ledger</CardTitle>
          <CardDescription>
            {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'} · grouped by day
          </CardDescription>
        </div>
        <div className="text-muted-foreground text-xs">
          Total <span className="text-foreground font-mono font-semibold">{formatCurrencyCents(total)}</span>
        </div>
      </CardHeader>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-t px-6 py-6 text-sm">No transactions match the current filters.</p>
      ) : (
        days.map((day) => (
          <div key={day.date}>
            <div className="bg-muted/40 text-muted-foreground flex items-center justify-between border-t px-6 py-2.5 text-xs font-semibold">
              <span>{dayFormatter.format(fromIsoDate(day.date))}</span>
              <span className="font-mono font-normal">{formatCurrencyCents(day.total)}</span>
            </div>
            {day.rows.map((t) => (
              <div
                key={t.transaction_id}
                className="grid grid-cols-[minmax(0,2fr)_1fr_1.2fr_auto] items-center gap-4 border-t px-6 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: accountColor(t.account_num) }} />
                  <span className="truncate text-sm font-medium">{t.description}</span>
                </div>
                <span className="text-muted-foreground truncate text-sm">{t.category}</span>
                <span className="text-muted-foreground truncate font-mono text-xs">{accountLabel(t)}</span>
                <span className="text-right font-mono text-sm font-medium tabular-nums">
                  −{formatCurrencyCents(spendOf(t))}
                </span>
              </div>
            ))}
          </div>
        ))
      )}

      {capped && (
        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          Showing the {MAX_ROWS} most recent of {rows.length} transactions — narrow the range or filters to see the rest.
        </p>
      )}
    </Card>
  );
}
