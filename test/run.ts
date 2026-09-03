/**
 * Test kosucusu.  Calistirmak icin:  npm test
 *
 * `lib/` saf oldugu icin (DOM, window, fetch yok) dogrudan Node'da calisir.
 * Sentetik ekstreler gercek ayristiriciya verilir; testler ayristirma yolunu
 * atlamaz.
 */

import * as A from '../lib/analysis';
import { sampleStatements } from '../lib/sample';
import { buildStatement, close, equals, expect, section, summary } from './helpers';

/**
 * Ornek veri artik her cagrida rastgele — kullanici her yenilemede baska bir
 * kart gorsun diye. Testler tohumu sabitler, yoksa iddialar kosudan kosuya
 * kayar ve kirmizi/yesil bir sey ifade etmez.
 */
const SEED = 20260726;
const statements = sampleStatements(SEED);
const transactions = A.allTransactions(statements);
const subscriptions = A.detectSubscriptions(transactions);

/* ================================================================== */
section('Doğrulama değişmezi — örnek set');

equals('sabit tohum aynı seti veriyor', sampleStatements(SEED).length, statements.length);
equals('bu tohumda 23 ekstre', statements.length, 23);
expect('yüksek hacim (>700 işlem)', transactions.length > 700, `${transactions.length} işlem`);

const broken = statements.filter((e) => e.verification.result !== 'matched');
expect(
  'HER ekstrenin mutabakatı tutuyor',
  broken.length === 0,
  broken
    .slice(0, 3)
    .map((e) => `${e.date}: ${e.verification.result}`)
    .join(' | ')
);
expect('overview.allVerified', A.overview(statements).allVerified === true);

/* ================================================================== */
section('Rastgelelik — her tohumda geçerli olmalı');

/**
 * Tek tohumun tutmasi bir sey kanitlamaz: kullanici her yenilemede baska bir
 * set goruyor. Mutabakat denklemi tohumlarin HEPSINDE tutmali, yoksa arayuz
 * bazen sessizce yanlis rakam gosterir.
 */
const seeds = Array.from({ length: 120 }, (_, i) => i * 2654435761 + 7);
const seedSets = seeds.map((s) => sampleStatements(s));

const brokenSeeds = seedSets
  .map((set, i) => ({ i, bad: set.filter((e) => e.verification.result !== 'matched') }))
  .filter((x) => x.bad.length > 0);
expect(
  `${seeds.length} rastgele tohumda mutabakat tutuyor`,
  brokenSeeds.length === 0,
  brokenSeeds
    .slice(0, 3)
    .map((x) => `tohum#${x.i}: ${x.bad[0].date} ${x.bad[0].verification.result}`)
    .join(' | ')
);

const sizes = new Set(seedSets.map((s) => s.length));
expect(
  'dönem sayısı 18-24 aralığında',
  [...sizes].every((n) => n >= 18 && n <= 24),
  [...sizes].sort((a, b) => a - b).join(',')
);
expect('en fazla 2 yıl', Math.max(...sizes) <= 24, `${Math.max(...sizes)} dönem`);
expect('tohumlar farklı set üretiyor', sizes.size > 1, `${sizes.size} farklı uzunluk`);

// Ayni tohum her zaman ayni seti vermeli, yoksa test yesil/kirmizi arasinda salinir.
equals(
  'aynı tohum → aynı toplam',
  A.overview(sampleStatements(seeds[0])).totalSpending,
  A.overview(seedSets[0]).totalSpending
);

/* ================================================================== */
section('Doğrulama üç durumu');

const healthy = buildStatement({
  summary: [0, 0, 3000, 0, 0, 3000],
  transactions: [
    { day: 5, description: 'MIGROS ESKISEHIR TR', amount: 1200 },
    { day: 9, description: 'SHELL PETROL ESKISEHIR', amount: 1800 },
  ],
});
equals('tutarlı ekstre → matched', healthy.verification.result, 'matched');

// Ozet kutusu HIC yok: karsilastirilacak rakam yok.
const noSummary = buildStatement({
  transactions: [
    { day: 5, description: 'MIGROS ESKISEHIR TR', amount: 1200 },
    { day: 9, description: 'SHELL PETROL ESKISEHIR', amount: 1800 },
  ],
});
equals('özet kutusu yok → unverifiable', noSummary.verification.result, 'unverifiable');
expect(
  'özet kutusu yok → "matched" DEĞİL (sessiz onay yok)',
  noSummary.verification.result !== 'matched'
);
equals('okunan harcama yine de hesaplanmış', noSummary.verification.computedPurchases, 3000);

// Ozet var ama tutmuyor: bir islem atlanmis gibi.
const mismatched = buildStatement({
  summary: [0, 0, 5000, 0, 0, 5000],
  transactions: [
    { day: 5, description: 'MIGROS ESKISEHIR TR', amount: 1200 },
    { day: 9, description: 'SHELL PETROL ESKISEHIR', amount: 1800 },
  ],
});
equals('özet tutmuyor → mismatch', mismatched.verification.result, 'mismatch');
equals('alan bazında: harcama tutmuyor', mismatched.verification.purchases, 'mismatch');

const mixed = A.overview([healthy, noSummary, mismatched]);
expect('karışık sette allVerified false', mixed.allVerified === false);
equals('özet: eşleşen', mixed.verificationCounts.matched, 1);
equals('özet: tutmayan', mixed.verificationCounts.mismatched, 1);
equals('özet: doğrulanamayan', mixed.verificationCounts.unverifiable, 1);

const findings3 = A.findings([healthy, noSummary, mismatched], []);
expect('doğrulama sorunu bulgu olarak çıkıyor', findings3.some((b) => b.kind === 'unverified'));
equals('ve listenin en başında', findings3[0]?.kind, 'unverified');

/* ================================================================== */
section('Aynı tarihli ekstre kaybı');

const cardA = buildStatement({
  cardNo: '5400 **** **** 1111',
  summary: [0, 0, 1000, 0, 0, 1000],
  transactions: [{ day: 5, description: 'MIGROS ESKISEHIR TR', amount: 1000 }],
});
const cardB = buildStatement({
  cardNo: '5400 **** **** 2222',
  summary: [0, 0, 2500, 0, 0, 2500],
  transactions: [{ day: 7, description: 'SHELL PETROL ESKISEHIR', amount: 2500 }],
});
expect('aynı tarih, farklı kart → farklı id', cardA.id !== cardB.id, `${cardA.id} / ${cardB.id}`);

const byId = new Map([cardA, cardB].map((e) => [e.id, e]));
equals('ikisi de korunuyor', byId.size, 2);
equals(
  'işlemlerin ikisi de sayılıyor',
  A.allTransactions([...byId.values()]).length,
  2
);

// Ayni kart, ayni tarih: gercek kopya, teki tutulmali.
const cardARepeat = buildStatement({
  cardNo: '5400 **** **** 1111',
  summary: [0, 0, 1000, 0, 0, 1000],
  transactions: [{ day: 5, description: 'MIGROS ESKISEHIR TR', amount: 1000 }],
});
const byId2 = new Map([cardA, cardARepeat].map((e) => [e.id, e]));
equals('aynı kart + aynı tarih → tek kayıt', byId2.size, 1);

// Donem suzgeci ekstre degil DONEM sayar.
const multiCard = [cardA, cardB];
equals('son 1 dönem, iki kart → iki ekstre', A.lastPeriods(multiCard, 1).length, 2);

/* ================================================================== */
section('Abonelik tespiti — pencere boyutundan bağımsız');

// Bu adlar `lib/sample.ts` ile birlikte degisir; orayi elleyince burayi da guncelle.
const SUBSCRIPTION = ['ORBITAL', 'FIGMA', 'VODAFONE', 'DISNEY', 'YOUTUBE', 'SPOTIFY'];
// Bunlar duzenli ama abonelik DEGIL: market, akaryakit, lokanta, magaza, taksit.
// Ucuncu test (ayin ayni gunu) gevsetilirse once bunlar yanlis pozitife duser.
const NOT_SUBSCRIPTION = [
  'DENIZYILDIZI', 'CINARALTI', 'SAHIL FIRIN', 'GUNDOGDU', 'KARABURUN', 'DOGALGAZ',
  'MARTI KAHVE', 'LODOS', 'YELKEN', 'MERCAN PETSHOP', 'PUSULA', 'TRAMVAY', 'BITAKSI',
  'TAZE SEPET', 'HEPSIBURADA', 'N11', 'DECATHLON', 'SAHAF', 'ATOLYE', 'TEKNOSA',
  'PEGASUS', 'KUMSAL', 'DALYAN', 'STEAMGAMES', 'ALIEXPRESS', 'BOOKING',
  'VESTEL', 'TEPE HOME', 'BELLONA', 'PHILIPS',
];

// 36 penceresi kalkti: set artik en fazla 24 donem.
for (const n of [3, 6, 12, 24, null]) {
  const set = A.lastPeriods(statements, n);
  const names = A.detectSubscriptions(A.allTransactions(set)).map((a) => a.merchant);
  const falsePositives = NOT_SUBSCRIPTION.filter((x) => names.some((a) => a.includes(x)));
  expect(`son ${n ?? 'tüm'} dönem: yanlış pozitif yok`, falsePositives.length === 0, falsePositives.join(', '));
  if (n === null || n >= 6) {
    const missing = SUBSCRIPTION.filter((x) => !names.some((a) => a.includes(x)));
    expect(`son ${n ?? 'tüm'} dönem: abonelikler bulundu`, missing.length === 0, missing.join(', '));
  }
}

// Ayni serviste ayin iki ayri gununde donen iki lisans: `parallelStreams = 2`.
const parallel = subscriptions.find((a) => a.merchant.includes('ORBITAL'));
equals('paralel akış sayıldı', parallel?.parallelStreams, 2);
expect(
  'tek akışlı abonelik 1 gösteriyor',
  subscriptions.find((a) => a.merchant.includes('SPOTIFY'))?.parallelStreams === 1
);
expect(
  'taksitli alışveriş abonelik sayılmıyor',
  !subscriptions.some((a) => a.merchant.includes('BELLONA') || a.merchant.includes('VESTEL'))
);
expect(
  'duran abonelik yakalandı',
  A.stoppedSubscriptions(transactions, subscriptions).some((a) => a.merchant.includes('TODTV')),
  A.stoppedSubscriptions(transactions, subscriptions).map((a) => a.merchant).join(', ')
);

/* ================================================================== */
section('Taksit projeksiyonu');

const plan = A.installmentSchedule(transactions);
expect('açık taksitli alışveriş var', plan.openItems >= 1, `${plan.openItems} kalem`);
expect('kalan yük hesaplandı', plan.remainingTotal > 0, `${plan.remainingTotal} TL`);
// Sabit tarih yazmak, ornek verinin bittigi ay degistiginde testi sessizce
// anlamsizlastiriyordu; son ekstreye gore olcuyoruz.
const lastPeriodMonth = statements[statements.length - 1].date.slice(0, 7);
expect(
  'son taksit ayı setin sonundan ileride',
  (plan.lastMonth ?? '') > lastPeriodMonth,
  `${plan.lastMonth} > ${lastPeriodMonth}`
);
close(
  'aylık toplamlar kalan yüke eşit',
  plan.months.reduce((s, a) => s + a.amount, 0),
  plan.remainingTotal,
  0.02
);

/* ================================================================== */
section('Faizsiz gün');

const fg = A.gracePeriod(statements);
expect('hesaplandı', fg !== null);
if (fg) {
  expect('ortalama makul aralıkta', fg.average > 5 && fg.average < 60, `${fg.average} gün`);
  const first = fg.distribution.find((d) => d.day === 1);
  const last = fg.distribution.find((d) => d.day === 27);
  expect(
    'ayın başı ayın sonundan avantajlı',
    !!first && !!last && first.averageDays > last.averageDays,
    first && last ? `1: ${first.averageDays} · 27: ${last.averageDays}` : '-'
  );
}

/* ================================================================== */
section('Yurt dışı harcamalar');

const foreign = A.foreignSpending(transactions);
// Esikler 120 tohumun en kotusune gore secildi (en dusuk: 66 islem, %55 artis);
// 5 yildan 2 yila inince kur artisi da dogal olarak kuculdu.
expect('dövizli işlem ayrıştırıldı', foreign.count > 50, `${foreign.count} işlem`);
expect('USD birimi var', foreign.currencies.some((b) => b.currency === 'USD'));
expect('EUR birimi var', foreign.currencies.some((b) => b.currency === 'EUR'));
const usd = foreign.currencies.find((b) => b.currency === 'USD');
expect('efektif kur dönem içinde arttı', (usd?.rateIncrease ?? 0) > 40, `%${usd?.rateIncrease.toFixed(0)}`);
expect('pay makul', foreign.share > 0 && foreign.share < 40, `%${foreign.share.toFixed(1)}`);

/* ================================================================== */
section('İade, nakit avans, kart kırılımı');

const refunds = A.refundAnalysis(transactions);
expect('iadeler raporlanıyor', refunds.count > 0 && refunds.total > 0, `${refunds.count} iade`);
const cashAdvance = A.cashAdvanceAnalysis(statements);
equals('nakit avans bulundu', cashAdvance.count, 1);
expect('nakit avans ücreti eşleşti', cashAdvance.fees > 0, `${Math.round(cashAdvance.fees)} TL`);
const split = A.cardSplit(transactions);
expect('sanal kart işlemleri ayrıldı', split.virtual.count > 0 && split.main.count > 0);

/* ================================================================== */
section('Ödeme disiplini ve alışkanlıklar');

const discipline = A.paymentDiscipline(statements);
equals('asgari ödenen dönem sayısı', discipline.minimum, 2);
expect('tam ödenen dönemler çoğunlukta', discipline.full > discipline.periods * 0.8);
equals(
  'durum sayıları toplamı dönem sayısına eşit',
  discipline.full + discipline.partial + discipline.minimum,
  discipline.periods
);

const habits = A.habits(transactions, subscriptions);
expect('alışkanlık tespit edildi', habits.length > 0, habits[0]?.merchant);
expect(
  'abonelikler alışkanlık listesinde yok',
  !habits.some((a) => a.merchant.includes('SPOTIFY') || a.merchant.includes('DISNEY'))
);

const churn = A.merchantChurn(transactions);
expect('son dönemde yeni işyeri', churn.added.length > 0, churn.added.map((y) => y.merchant).join(', '));
expect(
  'biten taksitler "terk edilen işyeri" sayılmıyor',
  !churn.dropped.some(
    (t) =>
      t.merchant.includes('VESTEL') ||
      t.merchant.includes('TEPE HOME') ||
      t.merchant.includes('BELLONA')
  ),
  churn.dropped.map((t) => t.merchant).join(', ')
);

/* ================================================================== */
section('Limit ve kategoriler');

equals('limit değişimi sayısı', A.limitChanges(statements).length, 4);
const categories = A.categoryTotals(transactions);
const otherShare = categories.find((k) => k.category === 'Diğer')?.share ?? 0;
expect('"Diğer" kategorisi küçük kalıyor', otherShare < 15, `%${otherShare.toFixed(1)}`);
close(
  'kategori toplamı genel toplama eşit',
  categories.reduce((s, k) => s + k.amount, 0),
  A.overview(statements).totalSpending,
  0.02
);

process.exit(summary());
