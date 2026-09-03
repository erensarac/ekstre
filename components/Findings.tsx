'use client';

import type { ReactNode } from 'react';
import type { Finding } from '@/lib/analysis';
import { tl, tl0, monthLabel } from '@/lib/analysis';

const formatDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

interface FindingText {
  title: ReactNode;
  detail: string;
  /** para kaybettiren / eylem gerektiren bulgu */
  severe: boolean;
}

/**
 * Bulguyu cumleye cevirir. lib katmani yapisal veri dondurur, metin burada
 * kurulur — analiz mantiginin icinde sunum dili tasimasin diye.
 */
function text(f: Finding): FindingText {
  switch (f.kind) {
    case 'unverified': {
      const parts: string[] = [];
      if (f.mismatched > 0) parts.push(`${f.mismatched} ekstrede fark var`);
      if (f.unverifiable > 0) parts.push(`${f.unverifiable} ekstre doğrulanamadı`);
      return {
        title: (
          <>
            {f.total} ekstrenin <b>{f.mismatched + f.unverifiable}</b> tanesi doğrulanmış değil
          </>
        ),
        detail: `${parts.join(
          ', '
        )}. Aşağıdaki bütün rakamlar bu ekstrelerden türüyor; mutabakat bölümünde hangi dönemler olduğunu görebilirsin. Doğrulanamayan bir dönem "doğru" demek değildir.`,
        severe: true,
      };
    }
    case 'interest':
      return {
        title: (
          <>
            <b>{tl(f.total)}</b> faiz ve vergi ödendi
          </>
        ),
        detail: `${f.periods} dönemde tahakkuk etti. Bu tutarın karşılığında hiçbir şey satın alınmadı.`,
        severe: true,
      };
    case 'cash-advance':
      return {
        title: (
          <>
            <b>{tl(f.amount)}</b> nakit avans çekilmiş
          </>
        ),
        detail: `${f.statements.map((e) => monthLabel(e)).join(', ')} döneminde. Nakit avansta faizsiz gün yoktur — faiz ilk günden işler. Bu dönemlerdeki ücret ve faiz toplamı ${tl0(
          f.fees
        )}.`,
        severe: true,
      };
    case 'grace-day':
      return {
        title: (
          <>
            Büyük harcamaları ayın <b>{f.bestDay}</b>&apos;ine çekersen{' '}
            <b>{f.gain.toFixed(0)} gün</b> daha uzun faizsiz kullanırsın
          </>
        ),
        detail: `${tl0(f.threshold)} üzeri harcamalarında ortalama ${f.largeAverage.toFixed(
          0
        )} gün faizsiz süre kullanıyorsun; genel ortalaman ${f.average.toFixed(
          0
        )} gün. Kesim tarihinden hemen sonra yapılan harcama en uzun süreyi alır.`,
        severe: false,
      };
    case 'habit':
      return {
        title: (
          <>
            {f.merchant} — ayda <b>{f.monthlyFrequency.toFixed(1)}</b> kez, toplam{' '}
            <b>{tl0(f.total)}</b>
          </>
        ),
        detail: `Abonelik değil, alışkanlık: tutarı değişiyor ama sıklığı sabit. Aylık ortalama ${tl0(
          f.monthlyAverage
        )}.`,
        severe: false,
      };
    case 'payment-discipline':
      return {
        title: (
          <>
            {f.periods} dönemin <b>{f.full}</b> tanesinde borç tam ödenmiş
          </>
        ),
        detail:
          f.ratio >= 95
            ? 'Ödeme disiplini yüksek; faiz yükü büyük ölçüde bundan dolayı düşük.'
            : `Tam ödeme oranı %${f.ratio.toFixed(0)}. Eksik ödenen her dönem bir sonraki ekstreye faiz olarak yansıyor.`,
        severe: f.ratio < 80,
      };
    case 'foreign':
      return {
        title: (
          <>
            Yurt dışı harcaman <b>{tl0(f.tryTotal)}</b> — toplamın <b>%{f.share.toFixed(1)}</b>{' '}
            kadarı
          </>
        ),
        detail: `${f.currency} bazlı harcamalarında efektif kur dönem başından bu yana %${f.rateIncrease.toFixed(
          0
        )} arttı. Efektif kur, ekstredeki TL tutarının döviz tutarına bölümüdür — komisyon dahildir.`,
        severe: false,
      };
    case 'refund':
      return {
        title: (
          <>
            <b>{tl0(f.total)}</b> iade almışsın ({f.count} işlem)
          </>
        ),
        detail: `En yüksek iade oranı ${f.topMerchant} tarafında: harcamanın %${f.topRatio.toFixed(
          0
        )} kadarı geri dönmüş. Net harcama hesabında iadeler zaten düşülmüştür.`,
        severe: false,
      };
    case 'minimum-payment':
      return {
        title: (
          <>
            <b>{f.statements.map((e) => monthLabel(e)).join(', ')}</b> döneminde asgari tutar ödenmiş
          </>
        ),
        detail:
          'Kalan borç bir sonraki ekstreye faiziyle devrediyor. Kredi kartı borcunun en pahalı hâli budur.',
        severe: true,
      };
    case 'duplicate-charge':
      return {
        title: (
          <>
            {f.merchant} — <b>{tl(f.amount)}</b> aynı gün {f.count} kez çekilmiş
          </>
        ),
        detail: `${formatDate(f.date)} tarihinde aynı tutar tekrarlanıyor. Mükerrer çekim olabilir; dekontla karşılaştırmaya değer.`,
        severe: true,
      };
    case 'price-increase':
      return {
        title: (
          <>
            {f.merchant} <b>{tl(f.before)}</b> → <b>{tl(f.after)}</b>
          </>
        ),
        detail: `${monthLabel(f.statement)} döneminde zamlandı ve o seviyede kaldı. Yıllık etkisi ${tl0(
          Math.abs(f.monthlyDelta) * 12
        )}.`,
        severe: false,
      };
    case 'stopped-subscription':
      return {
        title: (
          <>
            {f.merchant} artık çekilmiyor — son ödeme <b>{monthLabel(f.lastStatement)}</b>
          </>
        ),
        detail: `Düzenli dönerken durdu. İptal ettiysen sorun yok; etmediysen ${tl0(
          f.monthlyAmount
        )}/ay yeniden başlayabilir.`,
        severe: false,
      };
    case 'installment-load':
      return {
        title: (
          <>
            Önümüzdeki dönemler için <b>{tl(f.remainingTotal)}</b> taksit taahhüdün var
          </>
        ),
        detail: `${f.openItems} açık taksitli alışveriş, son taksit ${monthLabel(
          f.lastMonth
        )}. Bu tutar henüz hiçbir ekstrede görünmüyor.`,
        severe: false,
      };
    case 'outlier':
      return {
        title: (
          <>
            {f.merchant} — <b>{tl(f.amount)}</b>, olağanın {(f.amount / f.usual).toFixed(1)} katı
          </>
        ),
        detail: `${formatDate(f.date)}. Bu işyerinde alışılmış tutar ${tl0(f.usual)} civarında.`,
        severe: false,
      };
    case 'fixed-load':
      return {
        title: (
          <>
            Harcamanın <b>%{f.share.toFixed(0)}</b> kadarı sen hiçbir şey yapmasan da çıkıyor
          </>
        ),
        detail: `Abonelikler, taksitler ve faturalar toplamı ${tl0(
          f.fixed
        )}. Kısılabilecek kısım geri kalanı.`,
        severe: false,
      };
    case 'limit-change':
      return {
        title: (
          <>
            Kart limiti <b>{tl0(f.before)}</b> → <b>{tl0(f.after)}</b>
          </>
        ),
        detail: `${monthLabel(f.statement)} döneminde ${f.delta > 0 ? 'artırıldı' : 'düşürüldü'} (${
          f.delta > 0 ? '+' : ''
        }${tl0(f.delta)}).`,
        severe: false,
      };
    case 'category-change':
      return {
        title: (
          <>
            {f.category} <b>%{Math.abs(f.percent).toFixed(0)}</b>{' '}
            {f.percent > 0 ? 'arttı' : 'azaldı'}
          </>
        ),
        detail: `Önceki dönem ${tl0(f.before)}, bu dönem ${tl0(f.after)}.`,
        severe: false,
      };
  }
}

export default function Findings({ data }: { data: Finding[] }) {
  if (!data.length) return null;
  const severeCount = data.filter((f) => text(f).severe).length;

  return (
    <section className="section">
      <h2>Bulgular</h2>
      <div className="card finding-list">
        {data.map((f, i) => {
          const m = text(f);
          return (
            <div className={`finding${m.severe ? ' severe' : ''}`} key={`${f.kind}-${i}`}>
              <span className="finding-mark" aria-hidden>
                {m.severe ? '!' : '·'}
              </span>
              <div>
                <p className="finding-title">
                  {m.severe && <span className="visually-hidden">Dikkat: </span>}
                  {m.title}
                </p>
                <p className="finding-detail">{m.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="footnote">
        Bu maddelerin hiçbiri tahmin değil — hepsi ekstrelerde yazan tarih, tutar, taksit ve özet
        alanlarından hesaplandı.
        {severeCount > 0 && ` ${severeCount} tanesi doğrudan para kaybına işaret ediyor.`}
      </p>
    </section>
  );
}
