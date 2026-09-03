'use client';

import type { ReactNode } from 'react';
import type { InstallmentSummary, Overview, StatementTotal, Subscription } from '@/lib/analysis';
import { tl0, monthLabel } from '@/lib/analysis';

export default function Metrics({
  overview,
  periods,
  subscriptions,
  installments,
}: {
  overview: Overview;
  periods: StatementTotal[];
  subscriptions: Subscription[];
  installments: InstallmentSummary;
}) {
  const top = overview.topCategory;
  const subscriptionLoad = subscriptions.reduce((s, a) => s + a.monthlyAverage, 0);

  const last = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  const delta =
    last && previous && previous.amount > 0 ? (last.amount / previous.amount - 1) * 100 : null;

  return (
    <section className="section">
      <div className="hero">
        <div className="card hero-card">
          <p className="metric-label">Toplam harcama</p>
          <p className="hero-value">{tl0(overview.totalSpending)}</p>
          <p className="metric-sub">
            {overview.statementCount} ekstre · {overview.transactionCount} işlem · ödemeler hariç,
            iadeler düşülmüş
          </p>
          {periods.length >= 2 && <Sparkline data={periods} />}
        </div>

        <div className="metrics">
          <Tile
            label="Aylık ortalama"
            value={tl0(overview.monthlyAverage)}
            sub={
              delta === null || !last ? (
                'dönem başına'
              ) : (
                <>
                  {monthLabel(last.statement)}{' '}
                  <span className={delta > 0 ? 'delta-up' : 'delta-down'}>
                    {delta > 0 ? '▲' : '▼'} %{Math.abs(delta).toFixed(0)}
                  </span>{' '}
                  önceki döneme göre
                </>
              )
            }
          />
          <Tile
            label="En büyük kalem"
            value={top ? tl0(top.amount) : '—'}
            sub={top ? `${top.category} · %${top.share.toFixed(1)}` : '—'}
          />
          <Tile
            label="Tekrarlayan yük"
            value={subscriptions.length ? tl0(subscriptionLoad) : '—'}
            sub={
              subscriptions.length
                ? `${subscriptions.length} abonelik · ayda`
                : 'düzenli ödeme bulunamadı'
            }
          />
          <Tile
            label="Taksitli harcama"
            value={installments.count ? tl0(installments.amount) : '—'}
            sub={
              installments.count
                ? `${installments.count} işlem · %${installments.share.toFixed(0)}`
                : 'taksitli işlem yok'
            }
          />
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: ReactNode }) {
  return (
    <div className="card metric">
      <p className="metric-label">{label}</p>
      <p className="metric-value num">{value}</p>
      <p className="metric-sub">{sub}</p>
    </div>
  );
}

/** Son 12 donemin seyri; son nokta vurgu renginde, gerisi geri planda. */
function Sparkline({ data }: { data: StatementTotal[] }) {
  const points = data.slice(-12);
  const w = 240;
  const h = 42;
  const max = Math.max(...points.map((n) => n.amount), 1);
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const pos = (n: { amount: number }, i: number) =>
    [i * step, h - 4 - (n.amount / max) * (h - 10)] as const;

  const path = points.map((n, i) => `${i === 0 ? 'M' : 'L'}${pos(n, i).join(',')}`).join(' ');
  const [sx, sy] = pos(points[points.length - 1], points.length - 1);

  return (
    <svg
      className="sparkline"
      width={w + 8}
      height={h}
      role="img"
      aria-label={`Dönem seyri: ${points
        .map((n) => `${monthLabel(n.statement)} ${tl0(n.amount)}`)
        .join(', ')}`}
    >
      <path d={path} className="sparkline-path" transform="translate(4,0)" />
      <circle cx={sx + 4} cy={sy} r={3.5} className="sparkline-dot" />
    </svg>
  );
}
