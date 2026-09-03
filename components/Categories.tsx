'use client';

import type { CategoryTotal } from '@/lib/analysis';
import { tl0 } from '@/lib/analysis';

export default function Categories({ data }: { data: CategoryTotal[] }) {
  if (!data.length) return null;
  const max = data[0].amount || 1;

  return (
    <section className="section">
      <h2>Kategori dağılımı</h2>
      <div className="card category-list">
        {data.map((c) => (
          <div className="category" key={c.category}>
            <div className="category-head">
              <span>{c.category}</span>
              <em>
                {tl0(c.amount)} · %{c.share.toFixed(1)} · {c.count} işlem
              </em>
            </div>
            <div className="category-track">
              <div
                className="category-fill"
                style={{ width: `${Math.max((c.amount / max) * 100, 0.8)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
