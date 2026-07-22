import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { addDays, formatDayLabel } from './dates';

const PLOT_H = 300;
const PAD = { l: 56, r: 18, t: 16, b: 26 };

function fmtAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${(value / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

// The SVG is drawn at real pixel width so stroke weights stay uniform — scaling a fixed
// viewBox with preserveAspectRatio="none" would stretch the line and text horizontally.
function useMeasuredWidth(fallback = 760): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const next = Math.max(320, Math.round(el.getBoundingClientRect().width));
      setWidth((current) => (Math.abs(current - next) > 1 ? next : current));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export function BalanceChart({
  series,
  startBal,
  startISO,
  days,
}: {
  series: number[];
  startBal: number;
  startISO: string;
  days: number;
}) {
  const [ref, width] = useMeasuredWidth();

  // Prepend the opening balance so the line starts at "today" rather than at the close of
  // day 0 — otherwise a day-0 payment renders as a vertical cliff with no origin.
  const values = [startBal, ...series];
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // Always include $0 in the scale: a forecast that never dips negative still needs the
  // danger line visible for reference.
  const floor = Math.min(0, dataMin);
  const span = dataMax - floor || 1;
  const yMin = floor - span * 0.08;
  const yMax = dataMax + span * 0.12;

  const innerW = width - PAD.l - PAD.r;
  const innerH = PLOT_H - PAD.t - PAD.b;
  const X = (i: number) => PAD.l + (innerW * i) / (values.length - 1);
  const Y = (v: number) => PAD.t + innerH * (1 - (v - yMin) / (yMax - yMin));
  const baseY = PAD.t + innerH;

  const linePath = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${X(values.length - 1).toFixed(1)} ${baseY.toFixed(1)} L${X(0).toFixed(1)} ${baseY.toFixed(1)} Z`;

  const anyNegative = dataMin < 0;
  const lowIndex = values.indexOf(dataMin);
  const endIndex = values.length - 1;
  const ticks = [0, 1, 2, 3].map((t) => yMin + ((yMax - yMin) * t) / 3);
  const xLabels: number[] = [];
  for (let d = 6; d < days; d += 7) xLabels.push(d);

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold">
          Projected daily balance
          <span className="text-muted-foreground text-xs font-normal">
            today → {formatDayLabel(addDays(startISO, days - 1))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={ref} style={{ height: PLOT_H }} className="relative">
          <svg width={width} height={PLOT_H} role="img" aria-label="Projected daily checking balance">
            <defs>
              <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {ticks.map((value, i) => (
              <g key={`tick-${i}`}>
                <line x1={PAD.l} x2={width - PAD.r} y1={Y(value)} y2={Y(value)} stroke="var(--border)" strokeWidth={1} />
                <text
                  x={PAD.l - 8}
                  y={Y(value) + 3.5}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted-foreground)"
                  className="font-mono tabular-nums"
                >
                  {fmtAxis(value)}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#forecast-fill)" />

            {/* $0 danger line — emphasised only when the forecast actually crosses it. */}
            <line
              x1={PAD.l}
              x2={width - PAD.r}
              y1={Y(0)}
              y2={Y(0)}
              stroke="var(--destructive)"
              strokeWidth={1.25}
              strokeDasharray="5 4"
              opacity={anyNegative ? 0.9 : 0.4}
            />
            <text
              x={width - PAD.r}
              y={Y(0) - 5}
              textAnchor="end"
              fontSize={10}
              fill="var(--destructive)"
              opacity={anyNegative ? 1 : 0.55}
              className="font-mono"
            >
              $0
            </text>

            <path
              d={linePath}
              fill="none"
              stroke="var(--success)"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {[lowIndex, endIndex].map((i, k) => (
              <circle
                key={`marker-${k}`}
                cx={X(i)}
                cy={Y(values[i])}
                r={4}
                fill={values[i] < 0 ? 'var(--destructive)' : 'var(--success)'}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ))}

            <text x={X(0)} y={baseY + 16} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
              Now
            </text>
            {xLabels.map((d) => (
              <text
                key={`x-${d}`}
                x={X(d + 1)}
                y={baseY + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {formatDayLabel(addDays(startISO, d))}
              </text>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
