'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/parseEkstre';
import { tl, merchantTotals } from '@/lib/analysis';

const TOP_N = 12;

export default function Merchants({ transactions }: { transactions: Transaction[] }) {
  const [metric, setMetric] = useState<'amount' | 'count'>('amount');

  const all = useMemo(() => merchantTotals(transactions), [transactions]);
  const list = useMemo(
    () =>
      [...all]
        .sort((a, b) => (metric === 'amount' ? b.amount - a.amount : b.count - a.count))
        .slice(0, TOP_N),
    [all, metric]
  );

  if (all.length < 3) return null;

  const max = Math.max(...list.map((m) => (metric === 'amount' ? m.amount : m.count)), 1);
  const total = all.reduce((s, m) => s + m.amount, 0) || 1;
  const topTenShare = (list.slice(0, 10).reduce((s, m) => s + m.amount, 0) / total) * 100;

  return (
    <section className="section">
      <div className="section-head">
        <h2>İşyerleri</h2>
        <div className="chips" style={{ margin: 0 }}>
          <button
            className="chip"
            data-active={metric === 'amount' ? 1 : 0}
            onClick={() => setMetric('amount')}
          >
            Tutara göre
          </button>
          <button
            className="chip"
            data-active={metric === 'count' ? 1 : 0}
            onClick={() => setMetric('count')}
          >
            Adede göre
          </button>
        </div>
      </div>

      <div className="card ranking">
        {list.map((m) => {
          const value = metric === 'amount' ? m.amount : m.count;
          return (
            <div className="rank" key={m.merchant}>
              <span className="rank-name" title={m.merchant}>
                {m.merchant}
              </span>
              <span className="rank-track">
                <span
                  className="rank-fill"
                  style={{ width: `${Math.max((value / max) * 100, 1.5)}%` }}
                />
              </span>
              <span className="rank-value num">
                {metric === 'amount' ? tl(m.amount) : `${m.count} işlem`}
              </span>
              <span className="rank-sub num">
                {metric === 'amount'
                  ? `${m.count} işlem · ort. ${tl(m.amount / m.count)}`
                  : `${tl(m.amount)} · ort. ${tl(m.amount / m.count)}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="footnote">
        İşyeri adları şube ve şehir ekleri ayıklanarak birleştirildi ({all.length} ayrı işyeri). İlk
        on işyeri toplam harcamanın <strong>%{topTenShare.toFixed(1)}</strong> kadarını tutuyor.
      </p>
    </section>
  );
}
