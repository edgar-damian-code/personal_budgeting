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
import { formatCurrency, formatMonthLong } from '../../lib/format';
import { cardColor, cardName, formatSignedAmount, netIsGood } from './cards';
import type { CreditCardMonthlyRow } from './types';

export function ActivityTable({ cards, month }: { cards: CreditCardMonthlyRow[]; month: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Activity — {formatMonthLong(month)}</CardTitle>
        <CardDescription>Charges, payments &amp; net movement per card</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Net Activity</TableHead>
                <TableHead className="text-right">Txns</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => {
                const net = Number(c.net_activity);
                const netColor = netIsGood(net) ? 'text-success' : 'text-destructive';
                return (
                  <TableRow key={c.account_num}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: cardColor(c.account_num) }}
                        />
                        <div>
                          <div className="font-medium">{cardName(c.account_num, c.account)}</div>
                          <div className="text-muted-foreground text-xs">
                            {c.institution} ··{c.account_num}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(Number(c.charges))}</TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                      {formatCurrency(Number(c.payments_received))}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium tabular-nums ${netColor}`}>
                      {formatSignedAmount(net)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                      {Number(c.transaction_count)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {formatCurrency(Number(c.current_balance))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
