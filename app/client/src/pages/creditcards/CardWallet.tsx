import { formatCurrency, formatDateShort } from '../../lib/format';
import { cardFaceColor, cardName, formatSignedAmount } from './cards';
import type { CreditCardMonthlyRow } from './types';

function CardChip({ card }: { card: CreditCardMonthlyRow }) {
  // The face uses the EXACT brand hex, not the mark — this is the surface where the fill
  // should read as the real card. All four are dark, so the diagonal lifts toward white
  // (a darken would crush the navy into the background) and the ink is light.
  const color = cardFaceColor(card.account_num);
  return (
    <div
      className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-2xl p-5 shadow-lg"
      style={{
        background: `linear-gradient(140deg, color-mix(in srgb, ${color} 92%, #fff), ${color})`,
        color: 'var(--card-ink)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{cardName(card.account_num, card.account)}</div>
          <div className="text-xs font-medium opacity-90">{card.institution}</div>
        </div>
        {/* EMV chip decoration — a white scrim now that the faces are dark. */}
        <div className="h-5 w-7 rounded-sm bg-white/25" />
      </div>

      <div className="font-mono text-sm tracking-[0.12em] opacity-90">•••• {card.account_num}</div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold opacity-80">BALANCE</div>
          <div className="font-mono text-2xl font-bold tabular-nums">{formatCurrency(Number(card.current_balance))}</div>
        </div>
        <div className="text-xs opacity-90">as of {formatDateShort(card.balance_as_of)}</div>
      </div>

      <div className="flex justify-between border-t border-white/20 pt-2.5 font-mono text-xs">
        <span>Charged {formatCurrency(Number(card.charges))}</span>
        <span className="font-bold">{formatSignedAmount(Number(card.net_activity))}</span>
      </div>
    </div>
  );
}

export function CardWallet({ cards }: { cards: CreditCardMonthlyRow[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {cards.map((c) => (
        <CardChip key={c.account_num} card={c} />
      ))}
    </div>
  );
}
