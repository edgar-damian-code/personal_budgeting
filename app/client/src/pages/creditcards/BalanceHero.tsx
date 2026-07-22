import { Card, CardContent } from '@databricks/appkit-ui/react';
import { formatCurrency } from '../../lib/format';
import { cardColor, cardName } from './cards';
import { NetChip } from './NetChip';
import type { CreditCardMonthlyRow } from './types';

export type CardTotals = { balance: number; charges: number; payments: number; net: number };

function SplitBar({ cards }: { cards: CreditCardMonthlyRow[] }) {
  const total = cards.reduce((sum, c) => sum + Number(c.current_balance), 0);
  return (
    <div className="bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full">
      {cards.map((c) => {
        const pct = total > 0 ? (Number(c.current_balance) / total) * 100 : 0;
        return <div key={c.account_num} style={{ width: `${pct}%`, background: cardColor(c.account_num) }} />;
      })}
    </div>
  );
}

export function BalanceHero({ cards, totals }: { cards: CreditCardMonthlyRow[]; totals: CardTotals }) {
  return (
    <Card
      className="border"
      // Faint brand tint fading into the card surface (theme-aware via --card). Uses the
      // Amex navy FACE: --card-prime is now a neutral warm grey, which washed out to
      // nothing at 10%.
      style={{
        background:
          'linear-gradient(150deg, color-mix(in srgb, var(--card-aspire-face) 22%, var(--card)), var(--card))',
      }}
    >
      <CardContent className="flex flex-col gap-6 md:flex-row md:gap-0">
        <div className="flex-[1.3] md:border-r md:pr-8">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Total Balance — {cards.length} {cards.length === 1 ? 'Card' : 'Cards'}
          </span>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(totals.balance)}
            </span>
            <NetChip net={totals.net} big />
          </div>

          <div className="mt-5">
            <SplitBar cards={cards} />
            <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {cards.map((c) => (
                <span key={c.account_num}>
                  <span className="font-medium" style={{ color: cardColor(c.account_num) }}>
                    {cardName(c.account_num, c.account)}
                  </span>{' '}
                  {formatCurrency(Number(c.current_balance))}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 md:pl-8">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Charges this month</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(totals.charges)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Payments this month</span>
            <span className="text-success font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(totals.payments)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Net movement</span>
            <NetChip net={totals.net} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
