'use client';

import type { Habit, MerchantChurn } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';

const TOP_N = 8;

/**
 * Abonelik tespitinin bilincli kor noktasi: tutari degisen ama sikligi sabit
 * harcamalar. Yanina isyeri giris/cikislari da konur — ikisi de "davranis
 * degisikligi" merceginin parcasi.
 */
export default function Habits({ data, churn }: { data: Habit[]; churn: MerchantChurn }) {
  const list = data.slice(0, TOP_N);
  if (!list.length) return null;

  const max = list[0].total || 1;
  const monthlyTotal = data.reduce((s, h) => s + h.monthlyAverage, 0);

  return (
    <section className="section">
      <h2>Alışkanlıklar</h2>

      <div className="card ranking">
        {list.map((h) => (
          <div className="rank" key={h.merchant}>
            <span className="rank-name" title={h.merchant}>
              {h.merchant}
            </span>
            <span className="rank-track">
              <span
                className="rank-fill"
                style={{ width: `${Math.max((h.total / max) * 100, 1.5)}%` }}
              />
            </span>
            <span className="rank-value num">{tl(h.total)}</span>
            <span className="rank-sub num">
              ayda {h.monthlyFrequency.toFixed(1)} kez · ort. {tl(h.averageAmount)} · aylık{' '}
              {tl0(h.monthlyAverage)}
            </span>
          </div>
        ))}
      </div>

      <p className="footnote">
        Tutarı sabit olmadığı için abonelik sayılmayan, ama sıklığı sabit olan harcamalar. Toplam
        aylık yük <strong>{tl0(monthlyTotal)}</strong> — abonelik listesinde görünmediği için genelde
        gözden kaçar.
      </p>

      {(churn.added.length > 0 || churn.dropped.length > 0) && (
        <div className="card churn-card">
          {churn.added.length > 0 && (
            <p className="churn-row">
              <span className="churn-label">Son dönemde ilk kez</span>
              <span>
                {churn.added
                  .slice(0, 4)
                  .map((x) => `${x.merchant} (${tl0(x.amount)})`)
                  .join(' · ')}
              </span>
            </p>
          )}
          {churn.dropped.length > 0 && (
            <p className="churn-row">
              <span className="churn-label">Artık gidilmiyor</span>
              <span>
                {churn.dropped
                  .slice(0, 4)
                  .map((x) => `${x.merchant} (son ${monthLabel(x.lastStatement)})`)
                  .join(' · ')}
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
