'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/parseEkstre';
import type { Subscription } from '@/lib/analysis';
import { tl, tl0, subscriptionCalendar, monthLabel } from '@/lib/analysis';

export default function Subscriptions({
  data,
  transactions,
}: {
  data: Subscription[];
  transactions: Transaction[];
}) {
  const calendar = useMemo(() => subscriptionCalendar(transactions, data), [transactions, data]);

  if (!data.length) return null;
  const monthlyTotal = data.reduce((s, a) => s + a.monthlyAverage, 0);
  const parallel = data.filter((a) => a.parallelStreams > 1);
  const rows = new Map(calendar.rows.map((r) => [r.merchant, r]));

  return (
    <section className="section">
      <h2>Tekrarlayan ödemeler</h2>
      <div className="card">
        <div className="sub-head">
          <span />
          <span className="sub-strip-head">
            {calendar.statements.map((e) => (
              <em key={e}>{monthLabel(e).slice(0, 3)}</em>
            ))}
          </span>
          <span />
        </div>

        {data.map((a) => {
          const row = rows.get(a.merchant);
          return (
            <div className="sub" key={a.merchant}>
              <div style={{ minWidth: 0 }}>
                <p className="sub-name">
                  {a.merchant}
                  {a.parallelStreams > 1 && (
                    <span className="badge">{a.parallelStreams} paralel abonelik</span>
                  )}
                </p>
                <p className="sub-meta">
                  {a.count} çekim / {a.monthCount} ay · ayın {a.typicalDays.join(', ')}. günü ·
                  genelde {tl0(a.typicalAmount)}
                </p>
              </div>

              <span className="sub-strip" role="img" aria-label={stripSummary(a.merchant, row)}>
                {row?.cells.map((c) => (
                  <i
                    key={c.statement}
                    className={`strip-cell${c.count === 0 ? ' empty-cell' : c.count > 1 ? ' double' : ''}`}
                    title={
                      c.count === 0
                        ? `${monthLabel(c.statement)}: çekim yok`
                        : `${monthLabel(c.statement)}: ${c.count} çekim · ${tl(c.amount)}`
                    }
                  />
                ))}
              </span>

              <span className="sub-amount">
                {tl0(a.monthlyAverage)}
                <span style={{ color: 'var(--gri-acik)', fontSize: 12 }}>/ay</span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="footnote">
        En az üç ayrı ayda, neredeyse sabit tutarla dönen ödemeler. Toplam aylık yük{' '}
        <strong>{tl0(monthlyTotal)}</strong>. Şeritte her kare bir ekstre dönemi: dolu kare o dönem
        çekim yapıldığını, koyu kare aynı dönemde birden fazla çekimi, boş kare atlanan dönemi
        gösterir.
        {parallel.length > 0 && (
          <>
            {' '}
            {parallel.map((a) => a.merchant).join(', ')} için ayın farklı günlerinde ayrı ayrı çekim
            dönüyor — aynı anda çalışan birden çok abonelik olabilir.
          </>
        )}
      </p>
    </section>
  );
}

function stripSummary(
  merchant: string,
  row?: { cells: Array<{ statement: string; count: number }> }
) {
  if (!row) return merchant;
  const filled = row.cells.filter((c) => c.count > 0).length;
  const empty = row.cells.length - filled;
  return `${merchant}: ${row.cells.length} dönemin ${filled} tanesinde çekim var${
    empty ? `, ${empty} dönem atlanmış` : ''
  }.`;
}
