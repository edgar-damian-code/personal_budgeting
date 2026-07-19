import { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
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
import { formatMonthLong } from '../../lib/format';
import { BalanceHero, type CardTotals } from './BalanceHero';
import { CardWallet } from './CardWallet';
import { PaymentsSection } from './PaymentsSection';
import { ActivityTable } from './ActivityTable';
import type { CardPaymentRow, CreditCardMonthlyRow } from './types';

export function CreditCardsPage() {
  const noParams = useMemo(() => ({}), []);

  // Point-in-time page: the query returns the latest month automatically, so there is no
  // month selector — the month shown is derived from the returned rows.
  const { data: cardData, loading: cardLoading, error: cardError } = useAnalyticsQuery(
    'credit_card_monthly',
    noParams,
  );
  const cards = useMemo(() => (cardData ?? []) as CreditCardMonthlyRow[], [cardData]);

  // Recent payments are a running "last 12" across cards — not month-scoped.
  const { data: paymentData, loading: paymentLoading, error: paymentError } = useAnalyticsQuery(
    'card_payments',
    noParams,
  );
  const payments = useMemo(() => (paymentData ?? []) as CardPaymentRow[], [paymentData]);

  const totals = useMemo<CardTotals>(() => {
    let balance = 0;
    let charges = 0;
    let payments = 0;
    let net = 0;
    for (const c of cards) {
      balance += Number(c.current_balance);
      charges += Number(c.charges);
      payments += Number(c.payments_received);
      net += Number(c.net_activity);
    }
    return { balance, charges, payments, net };
  }, [cards]);

  const activeMonth = cards[0]?.month ?? null;
  const anyError = cardError ?? paymentError;
  const loading = cardLoading || paymentLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Credit Cards</h2>
        <p className="text-sm text-muted-foreground">
          Balances &amp; monthly activity{activeMonth ? ` · ${formatMonthLong(activeMonth)}` : ''}
        </p>
      </div>

      {anyError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load credit card data</AlertTitle>
          <AlertDescription>{anyError}</AlertDescription>
        </Alert>
      )}

      {loading && !anyError && (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <div className="flex flex-wrap gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 flex-[1_1_300px]" />
            ))}
          </div>
        </div>
      )}

      {!loading && !anyError && cards.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>No credit card data</EmptyTitle>
            <EmptyDescription>gold.credit_card_monthly has no rows yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !anyError && cards.length > 0 && activeMonth && (
        <>
          <BalanceHero cards={cards} totals={totals} />
          <CardWallet cards={cards} />
          <ActivityTable cards={cards} month={activeMonth} />
          <PaymentsSection cards={cards} payments={payments} />
        </>
      )}
    </div>
  );
}
