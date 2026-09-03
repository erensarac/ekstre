import type { Ekstre } from '@/lib/parseEkstre';
import { overview } from '@/lib/analysis';

/**
 * Raporun ilk sayfasi. Ekranda gorunmez (`app/print.css` yalnizca baskida
 * acar), yazdirma ciktisinda kapak olarak cikar.
 *
 * Kapakta once mutabakat durumu yer alir: bu uygulamanin tek gercek iddiasi,
 * rakamlarin ekstrenin kendi ozet kutusuyla dogrulanmis olmasi. Rapor elden
 * ele dolasabilecegi icin dogrulanamamis donemler burada da acikca yazilir,
 * "hepsi tamam" izlenimi verilmez.
 */
export default function ReportCover({
  statements,
  span,
}: {
  statements: Ekstre[];
  span: string | null;
}) {
  if (!statements.length) return null;

  const { verificationCounts: counts } = overview(statements);
  const cards = [...new Set(statements.map((e) => e.cardNo).filter(Boolean))] as string[];
  const printed = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="report-cover" aria-hidden="true">
      <p className="report-wordmark">
        ekstre<span>.</span>
      </p>
      <h1>Ekstre analiz raporu</h1>
      {span && <p className="report-span">{span}</p>}

      <dl className="report-facts">
        <div>
          <dt>Ekstre</dt>
          <dd>{statements.length}</dd>
        </div>
        <div>
          <dt>Kart</dt>
          <dd>{cards.length || 1}</dd>
        </div>
        <div>
          <dt>Rapor tarihi</dt>
          <dd>{printed}</dd>
        </div>
      </dl>

      <div className="report-verify">
        <h2>Mutabakat</h2>
        <p>
          Her dönemin işlem toplamı, ekstrenin kendi özet kutusundaki denklemle karşılaştırıldı:
          <em> önceki borç − ödemeler + harcamalar + nakit avans + faiz = ekstre borcu</em>.
        </p>
        <ul>
          <li>
            <strong>✓ {counts.matched}</strong> dönem tutuyor
          </li>
          {counts.mismatched > 0 && (
            <li>
              <strong>! {counts.mismatched}</strong> dönemde fark var — bu dönemlerin rakamlarına
              güvenmeyin
            </li>
          )}
          {counts.unverifiable > 0 && (
            <li>
              <strong>? {counts.unverifiable}</strong> dönemde özet kutusu okunamadı, yani{' '}
              <em>kontrol edilemedi</em> — doğru olduğu anlamına gelmez
            </li>
          )}
        </ul>
      </div>

      <p className="report-note">
        Bu rapor, PDF ekstrelerden tarayıcıda üretildi; veriler cihazdan çıkmadı. Resmî bir belge
        değildir, bankanızın kendi ekstresi esastır.
      </p>
    </section>
  );
}
