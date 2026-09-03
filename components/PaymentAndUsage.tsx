'use client';

import type { CardSplit, CashAdvanceSummary, PaymentDiscipline, Refunds } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';

const STATE_LABEL = { full: 'tam ödendi', partial: 'kısmi ödendi', minimum: 'asgari ödendi' } as const;

export default function PaymentAndUsage({
  discipline,
  cards,
  refunds,
  cashAdvance,
}: {
  discipline: PaymentDiscipline;
  cards: CardSplit;
  refunds: Refunds;
  cashAdvance: CashAdvanceSummary;
}) {
  if (discipline.periods < 3) return null;

  return (
    <section className="section">
      <h2>Ödeme ve kullanım</h2>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="card metric">
          <p className="metric-label">Tam ödenen dönem</p>
          <p className="metric-value num">
            {discipline.full}/{discipline.periods}
          </p>
          <p className="metric-sub">
            %{discipline.ratio.toFixed(0)}
            {discipline.minimum > 0 && ` · ${discipline.minimum} dönem asgari`}
          </p>
        </div>
        <div className="card metric">
          <p className="metric-label">Sanal kart payı</p>
          <p className="metric-value num">%{cards.virtualShare.toFixed(0)}</p>
          <p className="metric-sub">{cards.virtual.count} işlem · {tl0(cards.virtual.amount)}</p>
        </div>
        <div className="card metric">
          <p className="metric-label">İadeler</p>
          <p className="metric-value num">{refunds.count ? tl0(refunds.total) : '—'}</p>
          <p className="metric-sub">
            {refunds.count
              ? `${refunds.count} işlem · harcamanın %${refunds.ratio.toFixed(1)} kadarı`
              : 'iade yok'}
          </p>
        </div>
        <div className="card metric">
          <p className="metric-label">Nakit avans</p>
          <p className="metric-value num">{cashAdvance.count ? tl0(cashAdvance.amount) : '—'}</p>
          <p className="metric-sub">
            {cashAdvance.count
              ? `${cashAdvance.count} kez · ${tl0(cashAdvance.fees)} ücret ve faiz`
              : 'kullanılmamış'}
          </p>
        </div>
      </div>

      <div className="card discipline-card">
        <div className="discipline-strip" role="img" aria-label={stripSummary(discipline)}>
          {discipline.rows.map((r) => (
            <i
              key={r.statement}
              className={`discipline-cell ${r.state}`}
              title={`${monthLabel(r.statement)}: ${STATE_LABEL[r.state]} · ${tl(r.paid)} / ${tl(
                r.previousBalance
              )} (%${r.ratio.toFixed(0)})`}
            />
          ))}
        </div>
        <div className="legend-series">
          <span>
            <i className="discipline-key full" /> tam ödendi ({discipline.full})
          </span>
          {discipline.partial > 0 && (
            <span>
              <i className="discipline-key partial" /> kısmi ({discipline.partial})
            </span>
          )}
          {discipline.minimum > 0 && (
            <span>
              <i className="discipline-key minimum" /> asgari ({discipline.minimum})
            </span>
          )}
        </div>
      </div>

      {refunds.merchants.length > 0 && (
        <p className="footnote">
          En yüksek iade oranı{' '}
          {refunds.merchants
            .slice(0, 2)
            .map((x) => `${x.merchant} (%${x.ratio.toFixed(0)})`)
            .join(', ')}
          . Şeritte her kare bir dönemin ödeme durumu; soldan sağa zaman. Ödeme oranı, o dönemde
          yapılan ödemenin bir önceki ekstre borcuna bölümüdür.
        </p>
      )}
    </section>
  );
}

function stripSummary(d: PaymentDiscipline) {
  return `${d.periods} dönemin ${d.full} tanesinde borç tam ödendi${
    d.minimum ? `, ${d.minimum} dönemde asgari tutar ödendi` : ''
  }.`;
}
