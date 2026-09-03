'use client';

import type { Ekstre, VerificationState } from '@/lib/parseEkstre';
import { tl, monthLabel } from '@/lib/analysis';

const fmt = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('tr-TR'));

const MARK: Record<VerificationState, string> = {
  matched: '✓',
  mismatch: '!',
  unverifiable: '?',
};
const LABEL: Record<VerificationState, string> = {
  matched: 'Doğrulandı',
  mismatch: 'Fark var',
  unverifiable: 'Doğrulanamadı',
};

/**
 * Her ekstre icin bankanin kendi ozet kutusundaki denklemi yeniden kurar:
 *   onceki borc − odemeler + harcamalar + nakit avans + faiz = ekstre borcu
 *
 * Uc durum ayri gosterilir. "?" ile "✓" arasindaki fark bu aracin butun
 * iddiasidir: ozet kutusu okunamadiysa hicbir sey dogrulanmamistir, ve bunu
 * onay tiki gibi gostermek sessizce yanlis rakam sunmak olur.
 */
export default function Reconciliation({ statements }: { statements: Ekstre[] }) {
  const counts = {
    matched: statements.filter((e) => e.verification.result === 'matched').length,
    mismatch: statements.filter((e) => e.verification.result === 'mismatch').length,
    unverifiable: statements.filter((e) => e.verification.result === 'unverifiable').length,
  };

  return (
    <section className="section">
      <h2>Mutabakat</h2>
      <div className="card reconciliation">
        {statements.map((e) => {
          const s = e.summary;
          const v = e.verification;
          const extra = (s.cashAdvance ?? 0) + (s.interestAndTax ?? 0);
          return (
            <div className="rec-row" key={e.id}>
              <span className="rec-period">
                {monthLabel(e.date)}
                {e.cardNo && <em className="rec-card">{e.cardNo.slice(-4)}</em>}
              </span>
              <span className="equation">
                <span>{fmt(s.previousBalance)}</span>
                <span className="op">−</span>
                <span>{fmt(s.payments)}</span>
                <span className="op">+</span>
                <span>{fmt(s.purchases)}</span>
                {extra > 0 && (
                  <>
                    <span className="op">+</span>
                    <span>{fmt(extra)}</span>
                  </>
                )}
                <span className="op">=</span>
                <span className="equation-total">{fmt(s.statementBalance)}</span>
              </span>
              <span
                className={`mark ${v.result}`}
                title={description(e)}
                aria-label={LABEL[v.result]}
              >
                {MARK[v.result]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="footnote">
        Her satır, ekstredeki işlemlerin toplamının bankanın yazdığı bakiyeyle tutup tutmadığını
        gösterir.{' '}
        {counts.matched > 0 && (
          <>
            <strong>{counts.matched}</strong> ekstre doğrulandı — bu satırlarda hiçbir işlem
            atlanmamış.{' '}
          </>
        )}
        {counts.mismatch > 0 && (
          <>
            <strong>{counts.mismatch}</strong> ekstrede fark var; o dönemlerin rakamlarına
            güvenmeyin.{' '}
          </>
        )}
        {counts.unverifiable > 0 && (
          <>
            <strong>{counts.unverifiable}</strong> ekstrede özet kutusu okunamadı — <b>?</b> işareti
            &quot;doğru&quot; demek değildir, <em>kontrol edilemedi</em> demektir.
          </>
        )}
      </p>
    </section>
  );
}

function description(e: Ekstre): string {
  const v = e.verification;
  const part = (
    name: string,
    state: VerificationState,
    computed: number | null,
    declared: number | null
  ) => {
    if (state === 'matched') return `${name}: tutuyor`;
    if (state === 'unverifiable') return `${name}: ekstrede rakam okunamadı, karşılaştırılamadı`;
    return `${name}: okunan ${computed === null ? '—' : tl(computed)} — ekstredeki ${
      declared === null ? '—' : tl(declared)
    }`;
  };
  return [
    part('Harcamalar', v.purchases, v.computedPurchases, e.summary.purchases),
    part('Ödemeler', v.payments, v.computedPayments, e.summary.payments),
    part('Bakiye zinciri', v.balance, null, e.summary.statementBalance),
  ].join('\n');
}
