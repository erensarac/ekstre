'use client';

import { useState } from 'react';
import type { GracePeriod as GracePeriodData } from '@/lib/analysis';
import { tl0 } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { axisTicks, useWidth } from './measure';

const TOP = 18;
const BOTTOM = 28;
const LEFT = 34;
const RIGHT = 14;
const PLOT = 150;

/**
 * Ayin gunune gore faizsiz kullanim suresi. Kesim tarihinden hemen sonra
 * yapilan harcama bir sonraki ekstreye duser ve cok daha gec odenir; bu grafik
 * o egimi gosterir.
 */
export default function GracePeriod({ data }: { data: GracePeriodData | null }) {
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (!data || data.distribution.length < 10) return null;

  const w = Math.max(width, 320);
  const plotW = w - LEFT - RIGHT;
  const band = plotW / data.distribution.length;
  const thick = Math.min(18, band * 0.62);

  const max = Math.max(...data.distribution.map((d) => d.averageDays), 1);
  const ticks = axisTicks(max, 3);
  const ceiling = ticks[ticks.length - 1] || max;
  const y = (d: number) => TOP + PLOT - (d / ceiling) * PLOT;

  return (
    <section className="section">
      <h2>Faizsiz gün</h2>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="card metric">
          <p className="metric-label">Ortalama faizsiz süre</p>
          <p className="metric-value num">{data.average.toFixed(0)} gün</p>
          <p className="metric-sub">tüm harcamalarda</p>
        </div>
        <div className="card metric">
          <p className="metric-label">Büyük harcamalarda</p>
          <p className="metric-value num">{data.largeAverage.toFixed(0)} gün</p>
          <p className="metric-sub">
            {tl0(data.threshold)} üzeri · {data.largeCount} işlem
          </p>
        </div>
        <div className="card metric">
          <p className="metric-label">Kaçırılan süre</p>
          <p className="metric-value num">{data.gain > 0 ? `${data.gain.toFixed(0)} gün` : '—'}</p>
          <p className="metric-sub">ayın {data.bestDay}&apos;ine çekilse</p>
        </div>
      </div>

      <div className="card chart-card" ref={wrapper}>
        <div className="chart-body">
          <svg
            width={w}
            height={TOP + PLOT + BOTTOM}
            viewBox={`0 0 ${w} ${TOP + PLOT + BOTTOM}`}
            role="img"
            aria-label={`Ayın gününe göre ortalama faizsiz kullanım süresi. ${data.distribution
              .map((d) => `${d.day}: ${d.averageDays.toFixed(0)} gün`)
              .join(', ')}`}
          >
            {ticks.map((a) => (
              <g key={a}>
                <line x1={LEFT} x2={w - RIGHT} y1={y(a)} y2={y(a)} className="gridline" />
                <text x={LEFT - 8} y={y(a) + 4} className="axis-label" textAnchor="end">
                  {a}
                </text>
              </g>
            ))}

            {data.distribution.map((d, i) => {
              const center = LEFT + band * i + band / 2;
              const top = y(d.averageDays);
              const active = tooltip?.title === `Ayın ${d.day}. günü`;
              const best = d.day === data.bestDay;
              return (
                <g key={d.day}>
                  <rect
                    x={center - thick / 2}
                    y={top}
                    width={thick}
                    height={Math.max(TOP + PLOT - top, 2)}
                    rx={3}
                    className={`bar${active || best ? ' bar-active' : ''}`}
                  />
                  {(d.day === 1 || d.day % 5 === 0) && (
                    <text x={center} y={TOP + PLOT + 18} className="axis-label" textAnchor="middle">
                      {d.day}
                    </text>
                  )}
                  <rect
                    x={LEFT + band * i}
                    y={TOP}
                    width={band}
                    height={PLOT}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`Ayın ${d.day}. günü: ortalama ${d.averageDays.toFixed(0)} gün faizsiz, ${d.count} işlem`}
                    onMouseEnter={() => setTooltip(makeTooltip(d, center, top))}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={() => setTooltip(makeTooltip(d, center, top))}
                    onBlur={() => setTooltip(null)}
                  />
                </g>
              );
            })}
          </svg>
          <Tooltip data={tooltip} />
        </div>
      </div>

      <p className="footnote">
        Yatay eksen ayın günü, dikey eksen o gün yapılan harcamaların ortalama faizsiz kullanım
        süresi. Ekstre kesim tarihinden hemen sonra yapılan harcama bir sonraki ekstreye düştüğü için
        en uzun süreyi alır; kesime yakın yapılan aynı harcama birkaç hafta içinde ödenir. Süre,
        ekstredeki <strong>son ödeme tarihi</strong> ile işlem tarihi arasındaki farktır.
      </p>
    </section>
  );
}

function makeTooltip(
  d: { day: number; averageDays: number; count: number },
  x: number,
  yy: number
): TooltipData {
  const below = yy < 84;
  return {
    x,
    y: below ? yy + 10 : yy - 10,
    below,
    title: `Ayın ${d.day}. günü`,
    rows: [
      { label: 'ortalama faizsiz süre', value: `${d.averageDays.toFixed(0)} gün` },
      { label: 'işlem', value: String(d.count) },
    ],
  };
}
