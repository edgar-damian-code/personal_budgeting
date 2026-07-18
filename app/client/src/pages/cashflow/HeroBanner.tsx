import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@databricks/appkit-ui/react';
import { formatCurrency, formatMonthLong, formatPercent, formatSignedCurrency } from '../../lib/format';
import type { CashflowMonth } from './types';

function DeltaChip({ diff, isGood, big }: { diff: number; isGood: boolean; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${big ? 'text-sm' : 'text-xs'} ${isGood ? 'text-success' : 'text-destructive'}`}
    >
      {diff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      <span>{formatCurrency(Math.abs(diff))}</span>
      <span className="text-muted-foreground font-sans font-normal">vs last mo</span>
    </span>
  );
}

export function HeroBanner({
  activeRow,
  previousRow,
  ytdOutflows,
}: {
  activeRow: CashflowMonth;
  previousRow: CashflowMonth | null;
  ytdOutflows: number;
}) {
  const netIsGood = activeRow.net_cashflow >= 0;
  const incomeAbs = Math.max(activeRow.income, 0);
  const outflowAbs = Math.abs(activeRow.outflows);
  const total = incomeAbs + outflowAbs;
  const incomePct = total > 0 ? (incomeAbs / total) * 100 : 50;

  const netDiff = previousRow ? activeRow.net_cashflow - previousRow.net_cashflow : null;
  // Lower outflows is good; both sides compared as positive spend magnitudes.
  const outflowsMomDiff = previousRow ? outflowAbs - Math.abs(previousRow.outflows) : null;
  const savingsRate = activeRow.income !== 0 ? activeRow.net_cashflow / activeRow.income : null;

  return (
    <Card
      className={`border ${netIsGood ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}
    >
      <CardContent className="flex flex-col gap-6 md:flex-row md:gap-0">
        <div className="flex-[1.2] md:border-r md:pr-8">
          <div className="flex items-center gap-2">
            <span className="text-success text-sm font-semibold tracking-wide uppercase">Net Cash Flow</span>
            <span className="text-muted-foreground text-xs">{formatMonthLong(activeRow.month)}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <span
              className={`font-mono text-4xl font-semibold tracking-tight tabular-nums ${netIsGood ? 'text-success' : 'text-destructive'}`}
            >
              {formatSignedCurrency(activeRow.net_cashflow)}
            </span>
            {netDiff !== null && <DeltaChip diff={netDiff} isGood={netDiff >= 0} big />}
          </div>

          <div className="mt-5">
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
              <div className="bg-success h-full" style={{ width: `${incomePct}%` }} />
              <div className="bg-muted-foreground h-full" style={{ width: `${100 - incomePct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span>
                <span className="text-success font-medium">Income</span>{' '}
                <span className="text-muted-foreground">{formatCurrency(incomeAbs)}</span>
              </span>
              <span>
                <span className="text-muted-foreground font-medium">Outflows</span>{' '}
                <span className="text-muted-foreground">{formatCurrency(outflowAbs)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 md:pl-8">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">YTD Outflows</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(ytdOutflows)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Outflows MoM</span>
            {outflowsMomDiff !== null ? (
              <DeltaChip diff={outflowsMomDiff} isGood={outflowsMomDiff <= 0} />
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Savings Rate</span>
            <span
              className={`font-mono text-lg font-semibold tabular-nums ${savingsRate !== null && savingsRate >= 0 ? 'text-success' : 'text-destructive'}`}
            >
              {savingsRate !== null ? formatPercent(savingsRate) : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
