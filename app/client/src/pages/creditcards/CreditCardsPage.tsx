import { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
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
import { BalanceHero, type CardTotals } from './BalanceHero';
import { CardWallet } from './CardWallet';
import { PaymentsSection } from './PaymentsSection';
import { ActivityTable } from './ActivityTable';
import type { CardPaymentRow, CreditCardMonthlyRow, CreditCardMonthRow } from './types';

export function CreditCardsPage() {
  const noParams = useMemo(() => ({}), []);
  const { data: monthsData, loading: monthsLoading, error: monthsError } = useAnalyticsQuery(
    'credit_card_months',
    noParams,
  );

  const months = useMemo(() => {
    const rows = (monthsData ?? []) as CreditCardMonthRow[];
    return rows.map((r) => r.month).sort((a, b) => a.localeCompare(b));
  }, [monthsData]);

  const defaultMonth = useMemo(() => {
    if (!months.length) return null;
    const todayMonth = currentMonthStart();
    return months.includes(todayMonth) ? todayMonth : months[months.length - 1];
  }, [months]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? defaultMonth;

  const cardParams = useMemo(() => ({ month: sql.date(activeMonth ?? '1970-01-01') }), [activeMonth]);
  const { data: cardData, loading: cardLoading, error: cardError } = useAnalyticsQuery('credit_card_monthly', cardParams);
  const cards = useMemo(() => (cardData ?? []) as CreditCardMonthlyRow[], [cardData]);

  // Recent payments are not month-scoped (a running "last 12"), so no params.
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

  const anyError = monthsError ?? cardError ?? paymentError;
  const loading = monthsLoading || cardLoading || paymentLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Credit Cards</h2>
          <p className="text-sm text-muted-foreground">
            Balances &amp; monthly activity{activeMonth ? ` · ${formatMonthLong(activeMonth)}` : ''}
          </p>
        </div>
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
            <EmptyTitle>No credit card data for this month</EmptyTitle>
            <EmptyDescription>
              gold.credit_card_monthly has no rows for {activeMonth ? formatMonthLong(activeMonth) : 'this month'}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !anyError && cards.length > 0 && activeMonth && (
        <>
          <BalanceHero cards={cards} totals={totals} />
          <CardWallet cards={cards} />
          <PaymentsSection cards={cards} payments={payments} />
          <ActivityTable cards={cards} month={activeMonth} />
        </>
      )}
    </div>
  );
}
