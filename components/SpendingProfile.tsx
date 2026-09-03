'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/parseEkstre';
import { tl, weekdayDistribution, isSpending, amountDistribution } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { axisTicks, compact, useWidth } from './measure';

interface Bar {
  /** eksende yazilan kisa bicim */
  label: string;
  /** ipucu ve ekran okuyucu icin acik bicim */
  fullLabel?: string;
  value: number;
  rows: Array<{ label: string; value: string }>;
}

const TOP = 16;
const BOTTOM = 28;
const LEFT = 34;
const RIGHT = 14;
const PLOT = 132;

function MiniBarChart({ data, title, aria }: { data: Bar[]; title: string; aria: string }) {
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const w = Math.max(width, 260);
  const plotW = w - LEFT - RIGHT;
  const band = plotW / data.length;
  const thick = Math.min(24, band * 0.58);

  const max = Math.max(...data.map((v) => v.value), 1);
  const ticks = axisTicks(max, 3);
  const ceiling = ticks[ticks.length - 1] || max;
  const y = (d: number) => TOP + PLOT - (d / ceiling) * PLOT;

  return (
    <div className="card mini-card" ref={wrapper}>
      <p className="mini-title">{title}</p>
      <div className="chart-body">
        <svg
          width={w}
          height={TOP + PLOT + BOTTOM}
          viewBox={`0 0 ${w} ${TOP + PLOT + BOTTOM}`}
          role="img"
          aria-label={aria}
        >
          {ticks.map((a) => (
            <g key={a}>
              <line x1={LEFT} x2={w - RIGHT} y1={y(a)} y2={y(a)} className="gridline" />
              <text x={LEFT - 8} y={y(a) + 4} className="axis-label" textAnchor="end">
                {a === 0 ? '0' : compact(a)}
              </text>
            </g>
          ))}
          {data.map((v, i) => {
            const center = LEFT + band * i + band / 2;
            const top = y(v.value);
            const barTitle = v.fullLabel ?? v.label;
            const active = tooltip?.title === barTitle;
            const below = top < 88;
            const barTooltip: TooltipData = {
              x: center,
              y: below ? top + 10 : top - 10,
              below,
              title: barTitle,
              rows: v.rows,
            };
            return (
              <g key={v.label}>
                <rect
                  x={center - thick / 2}
                  y={top}
                  width={thick}
                  height={Math.max(TOP + PLOT - top, 2)}
                  rx={3}
                  className={`bar${active ? ' bar-active' : ''}`}
                />
                <text x={center} y={TOP + PLOT + 18} className="axis-label" textAnchor="middle">
                  {v.label}
                </text>
                <rect
                  x={LEFT + band * i}
                  y={TOP}
                  width={band}
                  height={PLOT}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${barTitle}: ${v.rows.map((r) => `${r.value} ${r.label}`).join(', ')}`}
                  onMouseEnter={() => setTooltip(barTooltip)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={() => setTooltip(barTooltip)}
                  onBlur={() => setTooltip(null)}
                />
              </g>
            );
          })}
        </svg>
        <Tooltip data={tooltip} />
      </div>
    </div>
  );
}

export default function SpendingProfile({ transactions }: { transactions: Transaction[] }) {
  const buckets = useMemo(() => amountDistribution(transactions), [transactions]);
  const days = useMemo(() => weekdayDistribution(transactions), [transactions]);

  const purchases = transactions.filter(isSpending);
  if (purchases.length < 10) return null;

  const totalCount = buckets.reduce((s, b) => s + b.count, 0) || 1;
  const totalAmount = buckets.reduce((s, b) => s + b.amount, 0) || 1;

  const smallCountShare = ((buckets[0]?.count ?? 0) / totalCount) * 100;
  const largeAmountShare =
    ((buckets[3]?.amount ?? 0) + (buckets[4]?.amount ?? 0)) / totalAmount * 100;

  const busiestDay = [...days].sort((a, b) => b.amount - a.amount)[0];

  return (
    <section className="section">
      <h2>Harcama profili</h2>
      <div className="pair">
        <MiniBarChart
          title="İşlem büyüklüğü"
          aria={`İşlem büyüklüğü dağılımı. ${buckets.map((b) => `${b.fullLabel}: ${b.count} işlem`).join(', ')}.`}
          data={buckets.map((b) => ({
            label: b.label,
            fullLabel: b.fullLabel,
            value: b.count,
            rows: [
              { label: 'işlem', value: String(b.count) },
              { label: 'toplam', value: tl(b.amount) },
              { label: 'harcamanın payı', value: `%${((b.amount / totalAmount) * 100).toFixed(1)}` },
            ],
          }))}
        />
        <MiniBarChart
          title="Haftanın günü"
          aria={`Haftanın günlerine göre harcama. ${days.map((d) => `${d.day} ${compact(d.amount)} lira`).join(', ')}.`}
          data={days.map((d) => ({
            label: d.day,
            value: d.amount,
            rows: [
              { label: 'harcama', value: tl(d.amount) },
              { label: 'işlem', value: String(d.count) },
            ],
          }))}
        />
      </div>
      <p className="footnote">
        İşlemlerin <strong>%{smallCountShare.toFixed(0)}</strong> kadarı 250 TL altında, buna karşılık
        paranın <strong>%{largeAmountShare.toFixed(0)}</strong> kadarı 2.500 TL üzeri işlemlerde.
        {busiestDay && busiestDay.amount > 0 && (
          <> En yoğun gün {busiestDay.day.toLocaleLowerCase('tr')} ({tl(busiestDay.amount)}).</>
        )}{' '}
        Gün, işlemin gerçekleştiği tarihe göredir — ekstre kesim tarihine değil.
      </p>
    </section>
  );
}
