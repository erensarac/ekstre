'use client';

import { useState } from 'react';
import type { HeatMap as HeatMapData } from '@/lib/analysis';
import { tl, monthLabel } from '@/lib/analysis';
import Tooltip, { type TooltipData } from './Tooltip';
import { compact } from './measure';

/** Marka morundan turetilmis sirali rampa (OKLCH'de sabit ton, tekduze L). */
const RAMP = ['#ffeef5', '#ffdbea', '#fdbed9', '#f49ac4', '#e472aa', '#c9418a', '#a7066b'];
/** Harcama dagilimi uzun kuyruklu; dogrusal olcek her hucreyi soluk birakiyor. */
const EXPONENT = 0.55;

const stepIndex = (intensity: number) =>
  intensity <= 0 ? -1 : Math.min(RAMP.length - 1, Math.floor(Math.pow(intensity, EXPONENT) * RAMP.length));

/** i. adimin alt sinirinin gercek TL karsiligi — gosterge bunu yazar. */
const stepFloor = (i: number, max: number) => Math.pow(i / RAMP.length, 1 / EXPONENT) * max;

export default function HeatMap({ data }: { data: HeatMapData }) {
  const [tableView, setTableView] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (data.rows.length === 0 || data.statements.length < 2) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Kategori × dönem</h2>
        <button className="chip" onClick={() => setTableView((t) => !t)} aria-pressed={tableView}>
          {tableView ? 'Isı haritası' : 'Tablo görünümü'}
        </button>
      </div>

      <div className="card">
        <div className="heat-shell">
        <div className="heat-scroll">
          <table className={`heat${tableView ? ' plain' : ''}`}>
            <thead>
              <tr>
                <th scope="col" className="heat-corner">
                  Kategori
                </th>
                {data.statements.map((statement) => (
                  <th scope="col" key={statement}>
                    {monthLabel(statement)}
                  </th>
                ))}
                <th scope="col" className="heat-total">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{row.category}</th>
                  {row.cells.map((cell) => {
                    const step = stepIndex(cell.intensity);
                    const empty = cell.count === 0;
                    return (
                      <td
                        key={cell.statement}
                        className={`heat-cell${step >= 5 ? ' inverted' : ''}${empty ? ' empty-cell' : ''}`}
                        style={tableView || empty ? undefined : { background: RAMP[step] }}
                        tabIndex={empty ? -1 : 0}
                        onMouseEnter={(ev) => setTooltip(empty ? null : makeTooltip(ev.currentTarget, row.category, cell))}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={(ev) => setTooltip(empty ? null : makeTooltip(ev.currentTarget, row.category, cell))}
                        onBlur={() => setTooltip(null)}
                      >
                        {empty ? '·' : tableView ? tl(cell.amount) : compact(cell.amount)}
                      </td>
                    );
                  })}
                  <td className="heat-total num">{tableView ? tl(row.total) : compact(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <Tooltip data={tooltip} />
        </div>

        {!tableView && (
          <div className="legend">
            <span className="legend-end">az</span>
            {RAMP.map((color, i) => (
              <span className="legend-swatch" key={color}>
                <i style={{ background: color }} />
                <em className="num">{i === 0 ? '0' : compact(stepFloor(i, data.max))}</em>
              </span>
            ))}
            <span className="legend-end">çok</span>
          </div>
        )}
      </div>

      <p className="footnote">
        Satırlar kategori, sütunlar ekstre dönemi. Renk yoğunluğu dönemdeki harcamayı gösterir;
        ölçek doğrusal değil (uzun kuyruğu açmak için karekök benzeri), gerçek eşikler göstergede
        yazılıdır. Kesin rakamlar için tablo görünümüne geçin.
      </p>
    </section>
  );
}

function makeTooltip(
  el: HTMLElement,
  category: string,
  cell: { statement: string; amount: number; count: number }
): TooltipData {
  // Konum kaydirilmayan dis kabuga gore; getBoundingClientRect zaten kaydirmayi
  // hesaba kattigi icin scrollLeft eklenmez.
  const shell = el.closest('.heat-shell') as HTMLElement | null;
  const a = el.getBoundingClientRect();
  const b = shell?.getBoundingClientRect();
  const top = a.top - (b?.top ?? 0);
  return {
    x: a.left - (b?.left ?? 0) + a.width / 2,
    y: top < 84 ? top + a.height : top - 6,
    below: top < 84,
    title: `${category} · ${monthLabel(cell.statement)}`,
    rows: [
      { label: 'harcama', value: tl(cell.amount) },
      { label: 'işlem', value: String(cell.count) },
    ],
  };
}
