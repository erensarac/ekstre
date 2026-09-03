'use client';

import { useState } from 'react';
import type { ForeignSpending as ForeignSpendingData, RatePoint } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { useWidth } from './measure';

const TOP = 14;
const BOTTOM = 22;
const LEFT = 46;
const RIGHT = 14;
const PLOT = 92;

/** Her para birimi kendi grafiginde — tek tonlu, kategorik renk gerekmiyor. */
function RateLine({ currency, trend }: { currency: string; trend: RatePoint[] }) {
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const height = TOP + PLOT + BOTTOM;

  // Tek noktadan "seyir" cikmaz. Eskiden null donuluyordu ve satirda basligin
  // altinda aciklamasiz bir bosluk kaliyordu.
  if (trend.length < 2) {
    return <p className="fx-note">Kur seyri için en az iki dönem gerekiyor.</p>;
  }

  // Olcum gelene kadar cizme. Eskiden `Math.max(width, 280)` vardi: olcum
  // gecikirse ya da hic gelmezse bu yedek deger kaliciya donuyor ve grafik
  // kartin dortte birinde sikisip kaliyordu.
  if (!width) return <div className="fx-chart" ref={wrapper} style={{ height }} />;

  const w = width;
  const plotW = w - LEFT - RIGHT;
  const max = Math.max(...trend.map((p) => p.rate));
  const min = Math.min(...trend.map((p) => p.rate));
  const range = max - min || 1;
  const x = (i: number) => LEFT + (i / Math.max(trend.length - 1, 1)) * plotW;
  const y = (k: number) => TOP + PLOT - ((k - min) / range) * PLOT;

  const linePath = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.rate)}`).join(' ');
  const last = trend[trend.length - 1];

  return (
    <div className="fx-chart" ref={wrapper}>
      <div className="chart-body">
        <svg
          width={w}
          height={height}
          // viewBox ekranda hicbir seyi degistirmez (olculerle birebir ayni),
          // baskida ise SVG'nin kagit genisligine orantili kucumesini saglar.
          viewBox={`0 0 ${w} ${height}`}
          role="img"
          aria-label={`${currency} efektif kur seyri: ${trend[0].rate} liradan ${last.rate} liraya`}
        >
          {[min, (min + max) / 2, max].map((k, i) => (
            <g key={i}>
              <line x1={LEFT} x2={w - RIGHT} y1={y(k)} y2={y(k)} className="gridline" />
              <text x={LEFT - 8} y={y(k) + 4} className="axis-label" textAnchor="end">
                {k.toFixed(1)}
              </text>
            </g>
          ))}
          <path d={linePath} className="rate-path" />
          <circle cx={x(trend.length - 1)} cy={y(last.rate)} r={4} className="rate-dot" />
          <text x={LEFT} y={TOP + PLOT + 16} className="axis-label">
            {monthLabel(trend[0].statement)}
          </text>
          <text x={w - RIGHT} y={TOP + PLOT + 16} className="axis-label" textAnchor="end">
            {monthLabel(last.statement)}
          </text>
          {trend.map((point, i) => (
            <rect
              key={point.statement}
              x={x(i) - plotW / trend.length / 2}
              y={TOP}
              width={plotW / trend.length}
              height={PLOT}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${monthLabel(point.statement)}: ${point.rate} lira`}
              onMouseEnter={() => setTooltip(makeTooltip(point, currency, x(i), y(point.rate)))}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(makeTooltip(point, currency, x(i), y(point.rate)))}
              onBlur={() => setTooltip(null)}
            />
          ))}
        </svg>
        <Tooltip data={tooltip} />
      </div>
    </div>
  );
}

function makeTooltip(point: RatePoint, currency: string, x: number, yy: number): TooltipData {
  const below = yy < 70;
  return {
    x,
    y: below ? yy + 10 : yy - 10,
    below,
    title: monthLabel(point.statement),
    rows: [{ label: `efektif ${currency} kuru`, value: `${point.rate.toFixed(2)} ₺` }],
  };
}

export default function ForeignSpending({ data }: { data: ForeignSpendingData }) {
  if (!data.currencies.length || data.count < 3) return null;

  return (
    <section className="section">
      <h2>Yurt dışı harcamalar</h2>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="card metric">
          <p className="metric-label">Toplam</p>
          <p className="metric-value num">{tl0(data.tryTotal)}</p>
          <p className="metric-sub">
            {data.count} işlem · harcamanın %{data.share.toFixed(1)} kadarı
          </p>
        </div>
        {data.currencies.slice(0, 2).map((cur) => {
          // Tek donemde kur "degisimi" olmaz; %0 artis yazmak yaniltici olur.
          const periodCount = data.trend.filter((p) => p.currency === cur.currency).length;
          return (
            <div className="card metric" key={cur.currency}>
              <p className="metric-label">{cur.currency} efektif kur</p>
              <p className="metric-value num">{cur.lastRate.toFixed(2)} ₺</p>
              <p className="metric-sub">
                {periodCount < 2 ? (
                  `tek dönem · ${cur.count} işlem`
                ) : (
                  <>
                    dönem başı {cur.firstRate.toFixed(2)} ₺ · %{cur.rateIncrease.toFixed(0)} artış
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card fx-list">
        {data.currencies.map((cur) => (
          <div className="fx-row" key={cur.currency}>
            <div className="fx-head">
              <span className="fx-currency">{cur.currency}</span>
              <span className="num fx-summary">
                {cur.foreignTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                {cur.currency} = {tl(cur.tryTotal)} · {cur.count} işlem
              </span>
            </div>
            <RateLine
              currency={cur.currency}
              trend={data.trend.filter((p) => p.currency === cur.currency)}
            />
          </div>
        ))}
      </div>

      <p className="footnote">
        Ekstre hem TL tutarını hem yabancı para tutarını yazıyor; ikisinin oranı{' '}
        <strong>efektif kur</strong>u verir — bankanın uyguladığı komisyon ve kur farkı bu rakamın
        içindedir, ayrıca bildirilmez. Çizgi her dönemin ortalama efektif kurudur.
      </p>
    </section>
  );
}
