import { Card, CardContent } from '@databricks/appkit-ui/react';
import { formatCurrency } from '../../lib/format';
import { bucketBy, totalSpend } from './aggregate';
import { formatRangeLabel, rangeDays } from './dateRange';
import type { IsoRange, SpendTransactionRow } from './types';

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="flex-[1_1_180px] py-4">
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-muted-foreground truncate text-xs">{sub}</span>
      </CardContent>
    </Card>
  );
}

export function SummaryStrip({ rows, range }: { rows: SpendTransactionRow[]; range: IsoRange }) {
  const total = totalSpend(rows);
  const days = rangeDays(range);
  const accounts = new Set(rows.map((r) => r.account_num)).size;
  const topCat = bucketBy(rows, (r) => r.category)[0];

  return (
    <div className="flex flex-wrap gap-4">
      <Stat label="Total Spend" value={formatCurrency(total)} sub={formatRangeLabel(range)} />
      <Stat
        label="Transactions"
        value={String(rows.length)}
        sub={`across ${accounts} ${accounts === 1 ? 'account' : 'accounts'}`}
      />
      <Stat label="Avg / Day" value={formatCurrency(total / days)} sub={`${days} days in range`} />
      <Stat
        label="Top Category"
        value={topCat ? topCat.key : '—'}
        sub={topCat ? `${formatCurrency(topCat.amount)} · ${Math.round((topCat.amount / total) * 100)}%` : 'no spend'}
      />
    </div>
  );
}
