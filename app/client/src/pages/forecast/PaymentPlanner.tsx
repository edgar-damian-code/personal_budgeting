import { Button, Card, CardContent, Input } from '@databricks/appkit-ui/react';
import { Plus, X } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { cardColor, cardFaceColor, cardInitials, cardShortName } from '../creditcards/cards';
import type { CreditCardMonthlyRow } from '../creditcards/types';
import { MoneyInput } from './MoneyInput';
import type { Plan, PlannedPayment } from './types';

type PayoffStatus = { text: string; color: string };

function payoffStatus(planned: number, owed: number, count: number): PayoffStatus {
  if (planned <= 0) return { text: 'No payments planned', color: 'var(--muted-foreground)' };
  if (planned > owed) {
    return {
      text: `${formatCurrency(planned)} planned · ${formatCurrency(planned - owed)} over balance`,
      color: 'var(--warning)',
    };
  }
  if (planned >= owed) {
    return {
      text: `Paid in full · ${formatCurrency(planned)} across ${count} ${count === 1 ? 'payment' : 'payments'}`,
      color: 'var(--success)',
    };
  }
  return {
    text: `${formatCurrency(planned)} of ${formatCurrency(owed)} planned · ${formatCurrency(owed - planned)} left`,
    color: 'var(--muted-foreground)',
  };
}

function CardPlanner({
  card,
  payments,
  minDate,
  maxDate,
  onUpdate,
  onAdd,
  onRemove,
}: {
  card: CreditCardMonthlyRow;
  payments: PlannedPayment[];
  minDate: string;
  maxDate: string;
  onUpdate: (index: number, patch: Partial<PlannedPayment>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  // Chip = filled surface -> exact brand hex; progress bar = thin mark -> tuned color.
  const accent = cardColor(card.account_num);
  const face = cardFaceColor(card.account_num);
  const owed = Number(card.current_balance) || 0;
  const planned = payments.reduce((sum, p) => sum + (Number(p.amt) || 0), 0);
  const status = payoffStatus(planned, owed, payments.length);
  const pct = owed > 0 ? Math.min(100, Math.round((planned / owed) * 100)) : 0;

  return (
    <Card className="min-w-0 flex-[1_1_320px] border">
      <CardContent className="px-5 py-4">
        <div className="mb-3.5 flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
            style={{ background: face, color: 'var(--card-ink)' }}
          >
            {cardInitials(card.account_num, card.account)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {cardShortName(card.account_num, card.account)}
            </div>
            <div className="text-muted-foreground font-mono text-xs">··{card.account_num}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Balance owed
            </div>
            <div className="font-mono text-base font-semibold tabular-nums">{formatCurrency(owed)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {payments.map((payment, index) => (
            <div key={index} className="flex items-center gap-2">
              <MoneyInput
                value={payment.amt}
                onChange={(amt) => onUpdate(index, { amt })}
                ariaLabel={`Payment amount for ${cardShortName(card.account_num, card.account)}`}
                className="min-w-0 flex-1"
              />
              <Input
                type="date"
                value={payment.date}
                min={minDate}
                max={maxDate}
                aria-label={`Payment date for ${cardShortName(card.account_num, card.account)}`}
                onChange={(e) => onUpdate(index, { date: e.target.value })}
                className="h-9 w-[150px] shrink-0"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Remove payment"
                onClick={() => onRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {payments.length === 0 && (
            <div className="text-muted-foreground px-0.5 py-1 text-xs">No payments planned yet.</div>
          )}
        </div>

        <Button variant="outline" className="mt-3 w-full border-dashed" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add a payment
        </Button>

        {/* With nothing planned the bar is a flat 0% and the status just repeats the empty
            hint above, so the whole payoff block stays hidden until there is progress. */}
        {payments.length > 0 && (
          <div className="mt-3.5">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
            </div>
            <div className="mt-1.5 text-xs" style={{ color: status.color }}>
              {status.text}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentPlanner({
  cards,
  plan,
  minDate,
  maxDate,
  onUpdate,
  onAdd,
  onRemove,
}: {
  cards: CreditCardMonthlyRow[];
  plan: Plan;
  minDate: string;
  maxDate: string;
  onUpdate: (cardNum: string, index: number, patch: Partial<PlannedPayment>) => void;
  onAdd: (cardNum: string) => void;
  onRemove: (cardNum: string, index: number) => void;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">Plan credit-card payments</h3>
      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
        Add one or more payments per card. Each posts to the ledger on its date.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        {cards.map((card) => (
          <CardPlanner
            key={card.account_num}
            card={card}
            payments={plan[card.account_num] ?? []}
            minDate={minDate}
            maxDate={maxDate}
            onUpdate={(index, patch) => onUpdate(card.account_num, index, patch)}
            onAdd={() => onAdd(card.account_num)}
            onRemove={(index) => onRemove(card.account_num, index)}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-[11px]">
        Card balances come from your latest snapshot. Your plan is saved in this browser only — it is never
        written back to Databricks.
      </p>
    </section>
  );
}
