import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@databricks/appkit-ui/react';
import { formatCurrency } from '../../lib/format';
import { groupColor } from '../../lib/groupColors';
import { bucketBy } from './aggregate';
import type { SpendTransactionRow } from './types';

const TOP_N = 6;

// MoM direction vs the prior equal-length period. More spend reads red (↑ higher),
// less reads green (↓ lower) — spend going down is the "good" direction.
function Movement({ current, prior }: { current: number; prior: number }) {
  const delta = current - prior;
  if (Math.abs(delta) < 0.01) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const higher = delta > 0;
  const Arrow = higher ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${higher ? 'text-destructive' : 'text-success'}`}>
      <Arrow className="h-3 w-3" />
      {higher ? 'higher' : 'lower'}
    </span>
  );
}

export function TopMerchants({
  rows,
  priorRows,
}: {
  rows: SpendTransactionRow[];
  priorRows: SpendTransactionRow[];
}) {
  const merchants = bucketBy(rows, (r) => r.description).slice(0, TOP_N);
  const max = merchants[0]?.amount ?? 0;

  const priorByMerchant = new Map(bucketBy(priorRows, (r) => r.description).map((b) => [b.key, b.amount]));
  const categoryByMerchant = new Map<string, string>();
  for (const r of rows) if (!categoryByMerchant.has(r.description)) categoryByMerchant.set(r.description, r.category);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
        <CardDescription>Highest spend · month-over-month movement</CardDescription>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No spend in the current filters.</p>
        ) : (
          <div className="divide-border divide-y">
            {merchants.map((m, i) => (
              <div
                key={m.key}
                className="grid grid-cols-[auto_1.9fr_2fr_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-muted-foreground w-5 font-mono text-xs">#{i + 1}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.key}</div>
                  <div className="text-muted-foreground text-xs">
                    {categoryByMerchant.get(m.key)} · {m.count} {m.count === 1 ? 'txn' : 'txns'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${max > 0 ? (m.amount / max) * 100 : 0}%`, background: groupColor(m.group) }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-sm tabular-nums">{formatCurrency(m.amount)}</span>
                </div>
                <div className="w-20 text-right">
                  <Movement current={m.amount} prior={priorByMerchant.get(m.key) ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
