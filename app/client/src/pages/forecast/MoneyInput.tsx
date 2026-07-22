import { useEffect, useState } from 'react';
import { Input } from '@databricks/appkit-ui/react';

// A currency field that keeps its own text draft.
//
// Binding a number straight to a number input makes the field impossible to clear —
// Number('') is 0, so backspacing the last digit snaps it back to "0" and the caret jumps.
// The draft holds whatever the user typed; the parsed value only propagates when it's a
// real number, and the draft re-syncs when the value changes from outside (reset, restore).
export function MoneyInput({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <div className={`border-input bg-background flex items-center rounded-md border px-2 ${className ?? ''}`}>
      <span className="text-muted-foreground font-mono text-sm">$</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const parsed = Number(raw);
          if (raw !== '' && Number.isFinite(parsed)) onChange(Math.max(0, parsed));
        }}
        onBlur={() => {
          // Committing on blur keeps an empty/garbage field from silently holding a stale
          // value: whatever the forecast is actually using becomes visible again.
          if (draft === '' || !Number.isFinite(Number(draft))) setDraft(String(value));
        }}
        className="h-9 border-0 bg-transparent px-1 font-mono tabular-nums shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
