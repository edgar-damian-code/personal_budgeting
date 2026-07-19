import { ArrowDown, ArrowUp } from 'lucide-react';
import { netIsGood, formatSignedAmount } from './cards';

// Net-movement indicator: paid-down (net ≤ 0) reads green with a down arrow; balance-up
// reads red with an up arrow. `big` bumps the size for the hero headline.
export function NetChip({ net, big }: { net: number; big?: boolean }) {
  const good = netIsGood(net);
  const color = good ? 'text-success' : 'text-destructive';
  const Arrow = good ? ArrowDown : ArrowUp;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${big ? 'text-sm' : 'text-xs'} ${color}`}
    >
      <Arrow className={big ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      <span>{formatSignedAmount(net)}</span>
      <span className="text-muted-foreground font-sans font-normal">{good ? 'paid down' : 'balance up'}</span>
    </span>
  );
}
