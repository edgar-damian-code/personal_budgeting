import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, ChevronDown } from 'lucide-react';
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@databricks/appkit-ui/react';
import { formatRangeLabel, fromIsoDate, presetRanges, toIsoDate } from './dateRange';
import type { IsoRange } from './types';

export function DateRangePicker({ range, onChange }: { range: IsoRange; onChange: (r: IsoRange) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  // Seed the draft from the committed range whenever the popover opens.
  function handleOpenChange(next: boolean) {
    if (next) setDraft({ from: fromIsoDate(range.start), to: fromIsoDate(range.end) });
    setOpen(next);
  }

  function apply(r: IsoRange) {
    onChange(r);
    setOpen(false);
  }

  const canApply = Boolean(draft?.from && draft?.to);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          <span className="text-muted-foreground text-xs font-normal">Range</span>
          <span className="font-mono text-xs">{formatRangeLabel(range)}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-1 p-3 sm:w-40 sm:border-r">
            <span className="text-muted-foreground px-2 pb-1 text-xs font-semibold tracking-wide uppercase">
              Quick ranges
            </span>
            {presetRanges().map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => apply(p.range)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={fromIsoDate(range.start)}
              selected={draft}
              onSelect={setDraft}
              className="p-3"
            />
            <Separator />
            <div className="flex items-center justify-between gap-3 p-3">
              <span className="text-muted-foreground text-xs">
                {draft?.from && draft?.to
                  ? `${toIsoDate(draft.from)} → ${toIsoDate(draft.to)}`
                  : 'Pick a start and end date'}
              </span>
              <Button
                size="sm"
                disabled={!canApply}
                onClick={() => draft?.from && draft?.to && apply({ start: toIsoDate(draft.from), end: toIsoDate(draft.to) })}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
