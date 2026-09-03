'use client';

import { useMemo, useState } from 'react';
import type { StatementTotal } from '@/lib/analysis';
import { tl, monthLabel } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { axisTicks, compact, useWidth } from './measure';

const TOP = 22;
const BOTTOM = 30;
// Sol bosluk yalnizca eksen etiketi kadar ("100b" ~26px + 10px nefes); daha
// genis birakilirsa grafik kartin icinde saga kaymis gorunuyor.
const LEFT = 40;
const RIGHT = 20;
const PLOT = 190;
const THICKNESS = 24;

const medianOf = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function PeriodChart({ data }: { data: StatementTotal[] }) {
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const median = useMemo(() => medianOf(data.map((v) => v.amount)), [data]);

  if (data.length < 2) return null;

  const w = Math.max(width, 320);
  const plotW = w - LEFT - RIGHT;
  const band = plotW / data.length;
  const thick = Math.min(THICKNESS, band * 0.55);

  const max = Math.max(...data.map((v) => v.amount), 1);
  const ticks = axisTicks(max);
  const ceiling = ticks[ticks.length - 1] || max;
  const y = (value: number) => TOP + PLOT - (value / ceiling) * PLOT;

  const maxIndex = data.reduce((best, v, i) => (v.amount > data[best].amount ? i : best), 0);
  // 60 donemde her sutuna etiket basmak okunmaz bir yigin uretiyor; etiketler
  // sigacak kadar seyreltilir, sonuncusu her zaman yazilir.
  const labelStep = Math.max(1, Math.ceil(46 / band));

  return (
    <section className="section">
      <h2>Ekstre bazında harcama</h2>
      <div className="card chart-card" ref={wrapper}>
        <div className="chart-body">
          <svg
            width={w}
            height={TOP + PLOT + BOTTOM}
            viewBox={`0 0 ${w} ${TOP + PLOT + BOTTOM}`}
            role="img"
            aria-label={`Ekstre bazında net harcama. ${data
              .map((v) => `${monthLabel(v.statement)} ${compact(v.amount)} lira`)
              .join(', ')}. Medyan ${compact(median)} lira.`}
          >
            {ticks.map((a) => (
              <g key={a}>
                <line x1={LEFT} x2={w - RIGHT} y1={y(a)} y2={y(a)} className="gridline" />
                <text x={LEFT - 10} y={y(a) + 4} className="axis-label" textAnchor="end">
                  {a === 0 ? '0' : compact(a)}
                </text>
              </g>
            ))}

            {/* Referans cizgisi sutunlarin ARKASINDA kalir; etiketi ise
                sutunlardan sonra cizilir (asagida) ki ustunu ortmesinler. */}
            {median > 0 && (
              <line x1={LEFT} x2={w - RIGHT} y1={y(median)} y2={y(median)} className="reference-line" />
            )}

            {data.map((v, i) => {
              const center = LEFT + band * i + band / 2;
              const top = y(v.amount);
              const height = Math.max(TOP + PLOT - top, 2);
              const active = tooltip?.title === titleOf(v);
              return (
                <g key={v.id}>
                  <path
                    d={roundedTopBar(center - thick / 2, top, thick, height, 4)}
                    className={`bar${active ? ' bar-active' : ''}`}
                  />
                  {i === maxIndex && (
                    <text x={center} y={top - 8} className="tip-label" textAnchor="middle">
                      {compact(v.amount)}
                    </text>
                  )}
                  {(i % labelStep === 0 || i === data.length - 1) && (
                    <text x={center} y={TOP + PLOT + 20} className="axis-label" textAnchor="middle">
                      {monthLabel(v.statement)}
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
                    aria-label={`${monthLabel(v.statement)}: ${tl(v.amount)}`}
                    onMouseEnter={() => setTooltip(makeTooltip(v, center, top))}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={() => setTooltip(makeTooltip(v, center, top))}
                    onBlur={() => setTooltip(null)}
                  />
                </g>
              );
            })}

            {/* Medyan etiketi en uste: kart renginde zemini sayesinde altindan
                gecen sutun uzerinde de okunur. */}
            {median > 0 &&
              (() => {
                const labelText = `medyan ${compact(median)}`;
                const labelWidth = labelText.length * 6.3 + 10;
                return (
                  <>
                    <rect
                      x={w - RIGHT - labelWidth}
                      y={y(median) - 18}
                      width={labelWidth}
                      height={15}
                      rx={3}
                      className="label-backdrop"
                    />
                    <text x={w - RIGHT - 5} y={y(median) - 7} className="reference-label" textAnchor="end">
                      {labelText}
                    </text>
                  </>
                );
              })()}
          </svg>
          <Tooltip data={tooltip} />
        </div>
      </div>
      <p className="footnote">
        Her sütun bir ekstre dönemidir; ödemeler düşülmemiş, iadeler düşülmüştür. Yatay çizgi{' '}
        {data.length} dönemin medyanı.
      </p>
    </section>
  );
}

/** Ayni donemde birden fazla kart olabilir; baslik kartin son dortlusunu tasir. */
function titleOf(v: StatementTotal): string {
  return v.cardNo ? `${monthLabel(v.statement)} · ${v.cardNo.slice(-4)}` : monthLabel(v.statement);
}

function makeTooltip(v: StatementTotal, x: number, yy: number): TooltipData {
  const rows = [{ label: 'net harcama', value: tl(v.amount) }];
  if (v.balance !== null) rows.push({ label: 'ekstre borcu', value: tl(v.balance) });
  if (v.limit !== null) rows.push({ label: 'kart limiti', value: tl(v.limit) });
  // Sutun tepesi yukaridaysa ipucu kartin disina tasar; asagi acilir.
  const below = yy < 96;
  return { x, y: below ? yy + 10 : yy - 12, below, title: titleOf(v), rows };
}

/** Ustu yuvarlak, tabani kare sutun — isaret ozelliklerindeki 4px kural. */
function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  const yc = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + yc} Q${x},${y} ${x + yc},${y} L${x + w - yc},${y} Q${x + w},${y} ${
    x + w
  },${y + yc} L${x + w},${y + h} Z`;
}
