'use client';

import type { InstallmentForecast } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';

/**
 * Henuz hicbir ekstrede gorunmeyen borc. "3/6" ifadesi kalan taksit sayisini
 * ve tutarini verdigi icin ileriye dogru taahhut edilmis yuk hesaplanabiliyor.
 */
export default function InstallmentSchedule({ data }: { data: InstallmentForecast }) {
  if (!data.months.length || !data.lastMonth) return null;

  const max = Math.max(...data.months.map((m) => m.amount), 1);

  return (
    <section className="section">
      <h2>Taksit takvimi</h2>

      <div className="card installment-card">
        <div className="installment-summary">
          <div>
            <p className="metric-label">Kalan taksit yükü</p>
            <p className="metric-value num">{tl0(data.remainingTotal)}</p>
            <p className="metric-sub">
              {data.openItems} açık alışveriş · son taksit {monthLabel(data.lastMonth)}
            </p>
          </div>
        </div>

        <div className="installment-months">
          {data.months.map((m) => (
            <div className="installment-month" key={m.month}>
              <span className="installment-label">{monthLabel(m.month)}</span>
              <span className="installment-track">
                <span
                  className="installment-fill"
                  style={{ width: `${Math.max((m.amount / max) * 100, 2)}%` }}
                />
              </span>
              <span className="installment-amount num">{tl(m.amount)}</span>
              <span className="installment-count">
                {m.count} kalem
              </span>
            </div>
          ))}
        </div>

        {data.items.length > 0 && (
          <div className="installment-items">
            {data.items.map((item) => (
              <p key={`${item.merchant}-${item.amount}-${item.totalInstallments}`}>
                <span className="installment-merchant">{item.merchant}</span>
                <span className="num">
                  {item.remaining}/{item.totalInstallments} taksit kaldı · {tl(item.amount)}/ay ·{' '}
                  {monthLabel(item.lastMonth)}
                  &apos;de biter
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <p className="footnote">
        Bu tutar hiçbir ekstrede yazmıyor; taksit alanındaki <code>3/6</code> gibi ifadelerden
        hesaplandı. Aynı alışveriş ardışık ekstrelerde tekrar göründüğü için en ileri taksit esas
        alınır — aksi hâlde aynı borç birden çok kez sayılırdı. Yeni taksitli harcama yaparsan bu
        takvim uzar.
      </p>
    </section>
  );
}
