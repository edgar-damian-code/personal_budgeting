import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { formatCurrency, formatDateShort } from '../../lib/format';
import { cardColor, cardName } from './cards';
import type { CardPaymentRow, CreditCardMonthlyRow } from './types';

function Dot({ accountNum }: { accountNum: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: cardColor(accountNum) }} />;
}

export function PaymentsSection({
  cards,
  payments,
}: {
  cards: CreditCardMonthlyRow[];
  payments: CardPaymentRow[];
}) {
  // payments are newest-first, so the first match per card is its most recent payment.
  const lastPaymentFor = (accountNum: string) => payments.find((p) => p.account_num === accountNum) ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Recent payments applied across your cards</CardDescription>
          </div>
          <span className="text-muted-foreground font-mono text-xs">last {payments.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-4">
          {cards.map((c) => {
            const lp = lastPaymentFor(c.account_num);
            return (
              <Card key={c.account_num} className="flex-[1_1_210px] py-4">
                <CardContent className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <Dot accountNum={c.account_num} />
                    <span className="text-sm font-semibold">{cardName(c.account_num, c.account)}</span>
                    <span className="text-muted-foreground text-xs">··{c.account_num}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-muted-foreground text-xs">Last payment</div>
                      <div className="mt-0.5 text-sm font-medium">{lp ? formatDateShort(lp.date) : '—'}</div>
                    </div>
                    <span className="text-success font-mono text-lg font-semibold tabular-nums">
                      {lp ? formatCurrency(Number(lp.amount)) : '—'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={`${p.date}-${p.account_num}-${p.amount}`}>
                  <TableCell className="text-muted-foreground font-mono">{formatDateShort(p.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Dot accountNum={p.account_num} />
                      <span className="font-medium">{cardName(p.account_num, p.account)}</span>
                      <span className="text-muted-foreground text-xs">
                        {p.institution} ··{p.account_num}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-success text-right font-mono font-semibold tabular-nums">
                    −{formatCurrency(Number(p.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
