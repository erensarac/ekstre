'use client';

import { useState } from 'react';
import type { LimitChange, LimitRow } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { axisTicks, compact, useWidth } from './measure';

/** Ayni rampanin adimlari — dolgu siddeti renkle degil, tonun koyulugu ile artar. */
const FILL = ['#e472aa', '#c9418a', '#a7066b'];
const fillTone = (ratio: number) => (ratio < 0.5 ? FILL[0] : ratio < 0.8 ? FILL[1] : FILL[2]);

/**
 * Ust bosluk sutunun uzerine yazilan etiket yiginina gore secilir.
 *
 * Yuzde etiketi tepe cizgisinin 9px, limit degisim rozeti 22px uzerine
 * yaziliyor. Limit eksen tavanina dayandiginda sutunun tepesi TOP'a cikiyor ve
 * 26px'lik boslukta rozet SVG'nin disina tasip kirpiliyordu. Rozet yalnizca
 * limitin degistigi donemlerde ciziliyor; hic yoksa genis bosluk bos serit
 * olarak kaliyor, o yuzden iki degerden biri seciliyor.
 */
const TOP_PLAIN = 26;
const TOP_WITH_BADGE = 46;
const BOTTOM = 30;
// Bkz. PeriodChart: sol bosluk eksen etiketi genisligiyle sinirli tutuluyor.
const LEFT = 40;
const RIGHT = 20;
const PLOT = 172;
const THICKNESS = 30;

export default function LimitUsage({
  data,
  changes,
}: {
  data: LimitRow[];
  changes: LimitChange[];
}) {
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const measurable = data.filter((v) => v.ratio !== null);
  if (measurable.length < 2) return null;

  const peakRatio = Math.max(...measurable.map((v) => v.ratio ?? 0));
  const changeByPeriod = new Map(changes.map((d) => [d.statement, d]));

  const w = Math.max(width, 320);
  const plotW = w - LEFT - RIGHT;
  const band = plotW / data.length;
  const thick = Math.min(THICKNESS, band * 0.5);

  // Bkz. PeriodChart: cok donemde etiketler ve yuzde yazilari seyreltilir.
  const labelStep = Math.max(1, Math.ceil(46 / band));
  const ratioStep = Math.max(1, Math.ceil(34 / band));

  const maxLimit = Math.max(...data.map((v) => v.limit ?? 0), 1);
  const ticks = axisTicks(maxLimit, 3);
  const ceiling = ticks[ticks.length - 1] || maxLimit;
  const top = changes.length > 0 ? TOP_WITH_BADGE : TOP_PLAIN;
  const y = (d: number) => top + PLOT - (d / ceiling) * PLOT;

  return (
    <section className="section">
      <h2>Limit ve kullanım</h2>

      <div className="card chart-card" ref={wrapper}>
        <div className="chart-body">
          <svg
            width={w}
            height={top + PLOT + BOTTOM}
            viewBox={`0 0 ${w} ${top + PLOT + BOTTOM}`}
            role="img"
            aria-label={`Dönem bazında kart limiti ve ekstre borcu. ${data
              .map(
                (v) =>
                  `${monthLabel(v.statement)}: limit ${
                    v.limit === null ? 'okunamadı' : compact(v.limit) + ' lira'
                  }, ` + `borç ${v.balance === null ? 'okunamadı' : compact(v.balance) + ' lira'}`
              )
              .join('. ')}`}
          >
            {ticks.map((a) => (
              <g key={a}>
                <line x1={LEFT} x2={w - RIGHT} y1={y(a)} y2={y(a)} className="gridline" />
                <text x={LEFT - 10} y={y(a) + 4} className="axis-label" textAnchor="end">
                  {a === 0 ? '0' : compact(a)}
                </text>
              </g>
            ))}

            {data.map((v, i) => {
              const center = LEFT + band * i + band / 2;
              const x = center - thick / 2;
              const baseline = top + PLOT;
              const limitY = v.limit === null ? baseline : y(v.limit);
              const balanceY = v.balance === null ? baseline : y(Math.max(v.balance, 0));
              const change = changeByPeriod.get(v.statement);
              return (
                <g key={v.id}>
                  {v.limit !== null && (
                    <>
                      <rect
                        x={x}
                        y={limitY}
                        width={thick}
                        height={Math.max(baseline - limitY, 2)}
                        rx={4}
                        className="limit-track"
                      />
                      {/* tavan cizgisi: acik yatak tek basina limiti okutmuyor */}
                      <line x1={x} x2={x + thick} y1={limitY} y2={limitY} className="limit-cap" />
                    </>
                  )}
                  {v.balance !== null && v.ratio !== null && (
                    <rect
                      x={x}
                      y={balanceY}
                      width={thick}
                      height={Math.max(baseline - balanceY, 2)}
                      rx={4}
                      fill={fillTone(v.ratio)}
                    />
                  )}
                  {v.ratio !== null && (i % ratioStep === 0 || i === data.length - 1) && (
                    <text x={center} y={limitY - 9} className="tip-label" textAnchor="middle">
                      %{(v.ratio * 100).toFixed(0)}
                    </text>
                  )}
                  {change && (
                    <text x={center} y={limitY - 22} className="limit-badge" textAnchor="middle">
                      {change.delta > 0 ? '+' : ''}
                      {compact(change.delta)}
                    </text>
                  )}
                  {(i % labelStep === 0 || i === data.length - 1) && (
                    <text x={center} y={baseline + 20} className="axis-label" textAnchor="middle">
                      {monthLabel(v.statement)}
                    </text>
                  )}
                  <rect
                    x={LEFT + band * i}
                    y={top}
                    width={band}
                    height={PLOT}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${monthLabel(v.statement)}: borç ${
                      v.balance === null ? 'okunamadı' : tl(v.balance)
                    }, limit ${v.limit === null ? 'okunamadı' : tl(v.limit)}`}
                    onMouseEnter={() => setTooltip(makeTooltip(v, change, center, limitY))}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={() => setTooltip(makeTooltip(v, change, center, limitY))}
                    onBlur={() => setTooltip(null)}
                  />
                </g>
              );
            })}
          </svg>
          <Tooltip data={tooltip} />
        </div>

        <div className="legend-series">
          <span>
            <i style={{ background: FILL[1] }} /> ekstre borcu
          </span>
          <span>
            <i className="track-sample" /> kart limiti
          </span>
        </div>
      </div>

      {/* Grafik ve olcer listesi ayri kartlar; bitisik durunca tek blok gibi
          okunuyordu. Bkz. ForeignSpending: ayni 14px araligi kullaniyor. */}
      <div className="card meter-list" style={{ marginTop: 14 }}>
        {data.map((v) => (
          <div className="meter" key={v.id}>
            <span className="meter-period">{monthLabel(v.statement)}</span>
            <span className="meter-track" title={v.ratio === null ? 'Limit okunamadı' : undefined}>
              {v.ratio !== null && (
                <span
                  className="meter-fill"
                  style={{ width: `${Math.min(v.ratio, 1) * 100}%`, background: fillTone(v.ratio) }}
                />
              )}
            </span>
            <span className="meter-ratio num">
              {v.ratio === null ? '—' : `%${(v.ratio * 100).toFixed(0)}`}
            </span>
            <span className="meter-sub num">
              {v.balance !== null ? tl(v.balance) : '—'}
              {v.limit !== null && <> / {tl(v.limit)}</>}
              {v.ratio !== null && v.ratio >= 0.9 && (
                <span className="badge" role="status">
                  ! limit sınırında
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="footnote">
        Sütunun tamamı o dönemin kart limiti, dolu kısmı ekstre borcu — limitin ne zaman değiştiği ve
        ne kadarını kullandığın aynı yerde görünür. En yüksek kullanım{' '}
        <strong>%{(peakRatio * 100).toFixed(0)}</strong>.
        {changes.length > 0 && (
          <>
            {' '}
            Limit {changes.length === 1 ? 'bir kez' : `${changes.length} kez`} değişmiş:{' '}
            {changes
              .map((d) => `${monthLabel(d.statement)} ${tl0(d.before)} → ${tl0(d.after)}`)
              .join('; ')}
            .
          </>
        )}{' '}
        Limit veya borç ekstreden okunamadıysa satır &quot;—&quot; gösterir; tahmin üretilmez.
      </p>
    </section>
  );
}

function makeTooltip(
  v: LimitRow,
  change: LimitChange | undefined,
  x: number,
  yy: number
): TooltipData {
  const rows = [
    { label: 'ekstre borcu', value: v.balance === null ? '—' : tl(v.balance) },
    { label: 'kart limiti', value: v.limit === null ? '—' : tl(v.limit) },
    { label: 'kullanım', value: v.ratio === null ? '—' : `%${(v.ratio * 100).toFixed(1)}` },
  ];
  if (v.available !== null) rows.push({ label: 'kullanılabilir', value: tl(v.available) });
  if (change)
    rows.push({
      label: 'limit değişimi',
      value: `${change.delta > 0 ? '+' : ''}${tl0(change.delta)}`,
    });

  const below = yy < 96;
  return { x, y: below ? yy + 30 : yy - 30, below, title: monthLabel(v.statement), rows };
}
