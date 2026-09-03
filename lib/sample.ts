import { itemsToRows, parseEkstreRows, type Ekstre } from './parseEkstre';

/**
 * Ornek ekstre seti — kurgusal bir karta ait 18-24 donem (en fazla iki yil).
 *
 * Elle uydurulmus Ekstre nesneleri degil: gercek ayristiricinin bekledigi
 * koordinatlarda metin parcalari uretilir ve `parseEkstreRows` ile okunur.
 * Boylece ornek veri de mutabakat denklemini gercekten saglar — arayuzde
 * gorulen tikler uydurma degildir. Denklem HER tohumda tutmak zorundadir:
 * ozet kutusundaki alti rakam, uretilen satirlarin kendi toplamlarindan
 * cikarilir, ayrica yazilmaz. `test/run.ts` bunu bir tohum kumesiyle kilitler.
 *
 * `sampleStatements()` argumansiz cagrildiginda rastgele bir tohum secer:
 * kullanici sayfayi her yeniledigi zaman baska bir kart gorur. Testler tohumu
 * acikca vererek ayni seti tekrar uretir — rastgelelik yalnizca tohum
 * secimindedir, uretec tohumdan itibaren tamamen deterministiktir.
 *
 * Icerik bilerek kurgusal: Izmir'de yasayan, akvaryumla ve yelkenle ugrasan
 * uydurma bir serbest cizerin karti. Isyerlerinin cogu uydurma adlardir ve
 * kimsenin gercek harcama profilini temsil etmez.
 *
 * Set, cikarimlarin her birini tetikleyecek sekilde kurgulanmistir:
 * abonelik zam/durma dongusu, paralel abonelik, cakisan taksitler, dovizli
 * harcamalar, nakit avans, iade, sanal kart, limit artislari, asgari odeme
 * sonrasi faiz, cift cekim, tutar sicramasi ve son donemde yeni isyeri.
 *
 * NOT: dovizli satirin "(12,34 USD)" bicimi, `merchantName` icindeki mevcut
 * temizleme kalibindan turetildi. Gercek bir Enpara ekstresinde bicim farkli
 * olabilir; uyarlarken once gercek satiri gormek gerekir.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round(n * 100) / 100;

const tl = (n: number) =>
  (n < 0 ? '- ' : '') +
  Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  ' TL';

const piece = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

/**
 * splitmix32 kullaniliyor: basit bir dogrusal uretecte ardisik tohumlar
 * birbirine yakin diziler uretiyordu, yani aylik "dalgalanma" aslinda duzgun
 * bir rampa oluyordu ve degisken harcamalar (su/dogalgaz faturasi) abonelik
 * gibi gorunuyordu. Karistirma adimi bu korelasyonu kaldirir. Rastgelelik
 * kaynagi degistirilecekse ayni tuzak: ardisik degerler arasinda korelasyon
 * olmamali.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  };
}

/**
 * Ana tohumdan donem basina bagimsiz akis. Tohumlari dogrudan `seed + k`
 * yapmak yetmez — once avalanche, sonra splitmix32'nin kendi adimi.
 */
function streamSeed(seed: number, k: number): number {
  let z = (seed + Math.imul(k + 1, 0x85ebca6b)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

/** En az 18 donem: abonelik testi ucu de 3 ay istiyor, 3/6/12 penceresi anlamli kalsin. */
const MIN_PERIODS = 18;
/** En fazla 24 donem: iki yildan uzun ornek uretilmez. */
const MAX_PERIODS = 24;

/**
 * Son ekstre donemi sabit (2026-06). Uretec `Date.now()`'a bakssaydi testler
 * bir gun kendiliginden kirilirdi; set her zaman geriye dogru uzatilir.
 */
const LAST_PERIOD = 2026 * 12 + 5;

const yearOf = (abs: number) => Math.floor(abs / 12);
const monthOf = (abs: number) => (abs % 12) + 1;

/** Donem k icin enflasyon carpani — iki yilda ~1,5 kat. */
const inflation = (k: number) => Math.pow(1.019, k);
/** Efektif dolar kuru (komisyon dahil): iki yilda ~1,8 kat. */
const fxRate = (k: number) => round2(27.5 * Math.pow(1.026, k));

/**
 * Kademeli fiyat. Donem araligi seviye sayisina bolunur; abonelikler set
 * ne kadar uzun olursa olsun ayni sayida zam gorur, boylece "zam" ve
 * "kalici fiyat degisimi" cikarimlari her tohumda tetiklenir.
 */
function level(k: number, count: number, levels: number[]): number {
  return levels[Math.min(levels.length - 1, Math.floor((k / count) * levels.length))];
}

/** Donem sayisina orantili kilometre tasi — 18 ile 24 arasinda hepsi ayrik kalir. */
const at = (count: number, fraction: number) => Math.round(count * fraction);

interface Entry {
  day: number;
  description: string;
  amount: number;
  installment?: string;
  kind?: 'purchase' | 'refund' | 'fee' | 'cashAdvance';
  virtual?: boolean;
}

/** Dovizli satir: TL tutari kurdan hesaplanir, aciklamaya doviz tutari yazilir. */
function foreign(
  day: number,
  name: string,
  foreignAmount: number,
  currency: 'USD' | 'EUR',
  k: number
): Entry {
  const value = round2(foreignAmount);
  const rate = currency === 'EUR' ? fxRate(k) * 1.09 : fxRate(k);
  const formatted = value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    day,
    description: `${name} (${formatted} ${currency})`,
    amount: round2(value * rate),
    virtual: true,
  };
}

/** Taksitli alisverisler: [baslangic orani, aciklama, aylik tutar, taksit sayisi] */
const INSTALLMENT_PLANS: Array<[number, string, number, number]> = [
  [0.1, 'VESTEL YETKILI SATICI IZMIR', 1850, 6],
  [0.35, 'TEPE HOME MOBILYA IZMIR', 2400, 9],
  [0.62, 'BELLONA MOBILYA IZMIR', 2750, 8],
  // Sonlara dogru baslar: kalan taksitler her zaman setin disina tasar, boylece
  // "ileriye taahhut edilmis borc" projeksiyonu bos kalmaz.
  [0.85, 'PHILIPS EV ALETLERI IZMIR', 3400, 12],
];

function monthEntries(
  k: number,
  count: number,
  seed: number,
  calendarMonth: number,
  minimumPaid: Set<number>
): Entry[] {
  const r = rng(streamSeed(seed, k));
  const e = inflation(k);
  /** 1..27 arasinda kalan, tabanin etrafina dagilmis gun */
  const day = (base: number, spread: number) =>
    Math.max(1, Math.min(27, Math.round(base + (r() - 0.5) * spread)));
  /** enflasyona tasinmis, oynak tutar */
  const amt = (base: number, volatility = 0.3) => base * e * (1 + (r() - 0.5) * volatility);
  /** ayda kac kez — degisken siklik, abonelik yanlis pozitifini eler */
  const times = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));

  const l: Entry[] = [];

  // --- abonelikler (kademeli zam) -----------------------------------------
  l.push({ day: 9, description: 'DISNEY PLUS AMSTERDAM', amount: level(k, count, [149.9, 219.9, 289.9]), virtual: true });
  l.push({ day: 3, description: 'SPOTIFY AB7K4X21 STOCKHOLM', amount: level(k, count, [59.99, 84.99, 109.99]), virtual: true });
  l.push({ day: 12, description: 'GOOGLE *YOUTUBE PREMIUM', amount: level(k, count, [79.99, 109.99, 139.99]), virtual: true });
  // Son uc donemde hic gorunmez: "durmus abonelik" bulgusu bunun uzerinden cikar.
  if (k < count - 3) {
    l.push({ day: 15, description: 'TODTV DIJITAL YAYIN', amount: level(k, count, [69.9, 99.9, 129.9]), virtual: true });
  }
  // Sabit fiyatli hat faturasi — tutari da gunu da oynamaz.
  l.push({ day: 24, description: 'VODAFONE FATURA ODEME', amount: level(k, count, [349, 429, 519]) });

  // Ayni serviste es zamanli iki lisans, dolar bazli: ayin iki ayri gununde
  // donen kume `parallelStreams = 2` olarak gorunur.
  l.push(foreign(17, 'ORBITAL YAZILIM LISANS DUBLIN', 19, 'USD', k));
  l.push(foreign(22, 'ORBITAL YAZILIM LISANS DUBLIN', 19, 'USD', k));
  l.push(foreign(19, 'FIGMA.COM SAN FRANCISCO', 15, 'USD', k));

  // --- duzenli ama abonelik OLMAYAN fatura --------------------------------
  // Kisin uce katlanan dogalgaz: her ay ayni gunlerde ama tutari savruk.
  // Ucuncu testi gecer, ikinci testte elenir; gevsetilirse yanlis pozitif olur.
  const winter = 1 + 1.6 * Math.max(0, Math.cos(((calendarMonth - 1) / 12) * 2 * Math.PI));
  l.push({ day: day(20, 10), description: 'IZMIR DOGALGAZ FATURASI', amount: amt(300 * winter, 0.45) });

  // --- dovizli / yurt disi -------------------------------------------------
  if (r() < 0.45) l.push(foreign(day(14, 8), 'STEAMGAMES.COM', 9.99 + Math.floor(r() * 4) * 10, 'USD', k));
  if (r() < 0.35) l.push(foreign(day(16, 10), 'ALIEXPRESS HONG KONG', 12 + r() * 60, 'USD', k));
  // EUR her tohumda en az iki kez gorunsun: yurt disi paneli bos kalmasin.
  if (k === at(count, 0.25)) l.push(foreign(8, 'BOOKING.COM AMSTERDAM', 180, 'EUR', k));
  if (k === at(count, 0.55)) l.push(foreign(11, 'BOOKING.COM AMSTERDAM', 320, 'EUR', k));

  // --- market / firin / akaryakit -----------------------------------------
  for (let n = 0, c = times(2, 4); n < c; n++) {
    l.push({ day: day(1 + n * 8, 9), description: 'DENIZYILDIZI MARKET IZMIR', amount: amt(520, 0.5) });
  }
  for (let n = 0, c = times(1, 3); n < c; n++) {
    l.push({ day: day(6 + n * 9, 9), description: 'CINARALTI BAKKAL IZMIR', amount: amt(160, 0.6) });
  }
  for (let n = 0, c = times(2, 4); n < c; n++) {
    l.push({ day: day(4 + n * 8, 8), description: 'SAHIL FIRIN VE PASTANESI IZMIR', amount: amt(115, 0.6) });
  }
  for (let n = 0, c = times(1, 2); n < c; n++) {
    l.push({ day: day(8 + n * 12, 10), description: 'GUNDOGDU PETROL IZMIR', amount: amt(900, 0.45) });
  }
  if (r() < 0.55) l.push({ day: day(21, 10), description: 'KARABURUN AKARYAKIT IZMIR', amount: amt(820, 0.45) });

  // --- kafe ve lokanta ------------------------------------------------------
  // Dagilmis gunlerde, oynak tutarli: abonelik SAYILMAMALI, "aliskanlik"
  // merceginin hedefi bunlar.
  for (let n = 0, c = times(3, 6); n < c; n++) {
    l.push({ day: day(3 + n * 5, 9), description: 'MARTI KAHVE IZMIR', amount: amt(95, 0.7) });
  }
  for (let n = 0, c = times(1, 3); n < c; n++) {
    l.push({ day: day(9 + n * 8, 10), description: 'LODOS LOKANTA IZMIR', amount: amt(340, 0.7) });
  }
  if (r() < 0.6) l.push({ day: day(17, 12), description: 'YELKEN PIZZA IZMIR', amount: amt(280, 0.6), virtual: true });

  // --- akvaryum ve saglik ---------------------------------------------------
  for (let n = 0, c = times(1, 2); n < c; n++) {
    l.push({ day: day(7 + n * 13, 10), description: 'MERCAN PETSHOP IZMIR', amount: amt(410, 0.55) });
  }
  if (r() < 0.5) l.push({ day: day(18, 12), description: 'AKVARYUM MAMA DUNYASI IZMIR', amount: amt(280, 0.5) });
  for (let n = 0, c = times(0, 2); n < c; n++) {
    l.push({ day: day(11 + n * 11, 10), description: 'PUSULA ECZANESI IZMIR', amount: amt(230, 0.6) });
  }

  // --- ulasim ---------------------------------------------------------------
  for (let n = 0, c = times(1, 3); n < c; n++) {
    l.push({ day: day(5 + n * 9, 8), description: 'TRAMVAY KART DOLUM IZMIR', amount: amt(150, 0.5) });
  }
  for (let n = 0, c = times(1, 3); n < c; n++) {
    l.push({ day: day(12 + n * 7, 10), description: 'BITAKSI IZMIR', amount: amt(190, 0.6), virtual: true });
  }

  // --- online alisveris (sanal kart) ---------------------------------------
  for (let n = 0, c = times(1, 3); n < c; n++) {
    l.push({ day: day(10 + n * 8, 10), description: 'TAZE SEPET MARKET ONLINE', amount: amt(430, 0.55), virtual: true });
  }
  if (r() < 0.4) l.push({ day: day(13, 12), description: 'HEPSIBURADA IZMIR TR', amount: amt(1250, 0.6), virtual: true });
  if (r() < 0.3) l.push({ day: day(20, 12), description: 'N11 ALISVERIS', amount: amt(760, 0.6), virtual: true });
  if (r() < 0.25) l.push({ day: day(15, 12), description: 'DECATHLON IZMIR', amount: amt(1400, 0.5) });
  if (r() < 0.3) l.push({ day: day(23, 10), description: 'SAHAF KITAP EVI IZMIR', amount: amt(320, 0.6) });
  // Hicbir kurala uymayan kucuk kalem — "Diğer" kategorisi bos da olmasin,
  // buyuk de olmasin.
  if (r() < 0.4) l.push({ day: day(13, 10), description: 'ATOLYE KIRTASIYE IZMIR', amount: amt(210, 0.6) });

  // --- tek seferlik buyuk kalemler -----------------------------------------
  if (k === at(count, 0.55)) {
    l.push({ day: 12, description: 'PEGASUS HAVA YOLLARI', amount: amt(4200, 0.1), virtual: true });
    l.push({ day: day(18, 4), description: 'KUMSAL BUTIK OTEL ANTALYA', amount: amt(6800, 0.1) });
  }
  // Her zamanki market alisverisinin cok uzerinde tek cekim — "tutar sicramasi"
  if (k === at(count, 0.7)) {
    l.push({ day: 12, description: 'DENIZYILDIZI MARKET IZMIR', amount: amt(4800, 0.05) });
  }
  // Son donemde ilk kez gorunen isyerleri — "yeni isyeri" sinyali
  if (k === count - 1) {
    l.push({ day: 20, description: 'TEKNOSA IZMIR', amount: amt(9200, 0.1) });
    l.push({ day: 9, description: 'DALYAN VETERINER KLINIGI IZMIR', amount: amt(680, 0.2) });
  }

  // --- ayni gun cift cekim --------------------------------------------------
  if (k === at(count, 0.45)) {
    const c = amt(560, 0);
    l.push({ day: 14, description: 'LODOS LOKANTA IZMIR', amount: c });
    l.push({ day: 14, description: 'LODOS LOKANTA IZMIR', amount: c });
  }

  // --- iadeler --------------------------------------------------------------
  // Asgari odenen donemlerde iade yok: orada ozet kutusundaki "odemeler"
  // tam olarak onceki asgariye esit kalmali, yoksa odeme karnesi bulaniklasir.
  if (k % 5 === 3 && !minimumPaid.has(k)) {
    l.push({ day: day(25, 3), description: 'TAZE SEPET MARKET ONLINE (iade)', amount: -amt(380, 0.5), kind: 'refund', virtual: true });
  }
  if (k === at(count, 0.75) && !minimumPaid.has(k)) {
    l.push({ day: 19, description: 'HEPSIBURADA IZMIR TR (iade)', amount: -amt(2400, 0.2), kind: 'refund', virtual: true });
  }

  // --- taksitler ------------------------------------------------------------
  for (const [fraction, name, amount, total] of INSTALLMENT_PLANS) {
    const start = at(count, fraction);
    const seq = k - start + 1;
    if (seq >= 1 && seq <= total) {
      l.push({ day: 6, description: name, amount: round2(amount * inflation(start)), installment: `${seq}/${total}` });
    }
  }

  // --- nakit avans (bir kez) ve ucretleri -----------------------------------
  if (k === at(count, 0.5)) {
    l.push({ day: 10, description: 'Karttan nakit avans', amount: amt(6000, 0), kind: 'cashAdvance' });
    l.push({ day: 10, description: 'Nakit avans ücreti', amount: amt(240, 0), kind: 'fee' });
    l.push({ day: 27, description: 'Nakit avans faizi BSMV dahil', amount: amt(410, 0), kind: 'fee' });
  }

  // Mutabakatin tek sarti: ozet kutusuna yazilan toplam ile satirlarda yazan
  // tutar birebir ayni olsun. Satirlar iki haneli biciminde basildigi icin
  // tutarlar burada — tek yerde — kuruse yuvarlanir.
  return l.map((x) => ({ ...x, amount: round2(x.amount) }));
}

/** Kart limiti basamaklari; her basamak bir "limit artisi" bulgusu uretir. */
const LIMITS = [25000, 35000, 50000, 70000, 95000];
const LIMIT_STEPS = [0.2, 0.4, 0.6, 0.8];

/**
 * Ornek set uretir.
 *
 * @param seed verilmezse rastgele secilir — kullanici her yenilemede baska bir
 * kart gorur. Test icin sabit bir sayi verilir; ayni tohum her zaman ayni seti
 * dondurur.
 */
export function sampleStatements(seed?: number): Ekstre[] {
  const masterSeed = (seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
  const master = rng(masterSeed);
  const count = MIN_PERIODS + Math.floor(master() * (MAX_PERIODS - MIN_PERIODS + 1));

  const firstPeriod = LAST_PERIOD - (count - 1);
  const limitSteps = LIMIT_STEPS.map((f) => at(count, f));
  // Asgari odenen iki donem — takip eden ekstrede gecikme faizi cikar.
  const minimumPaid = new Set([at(count, 0.35), at(count, 0.7)]);

  const out: Ekstre[] = [];
  let previousBalance = 0;
  let previousMin = 0;
  let paidMinimumLast = false;

  for (let k = 0; k < count; k++) {
    const abs = firstPeriod + k;
    const year = yearOf(abs);
    const month = pad2(monthOf(abs));
    const nextYear = yearOf(abs + 1);
    const nextMonth = pad2(monthOf(abs + 1));

    const entries = monthEntries(k, count, masterSeed, monthOf(abs), minimumPaid);

    const purchaseTotal = round2(
      entries.filter((x) => (x.kind ?? 'purchase') === 'purchase').reduce((s, x) => s + x.amount, 0)
    );
    const refundTotal = round2(
      -entries.filter((x) => x.kind === 'refund').reduce((s, x) => s + x.amount, 0)
    );
    const cashAdvanceTotal = round2(
      entries.filter((x) => x.kind === 'cashAdvance').reduce((s, x) => s + x.amount, 0)
    );
    let interestTotal = round2(entries.filter((x) => x.kind === 'fee').reduce((s, x) => s + x.amount, 0));

    // Onceki donem asgari odendiyse bu ekstrede gecikme faizi tahakkuk eder.
    const lateInterest = paidMinimumLast ? round2(previousBalance * 0.037) : 0;
    if (lateInterest > 0) {
      entries.push({ day: 27, description: 'Gecikme faizi KKDF ve BSMV dahil', amount: lateInterest, kind: 'fee' });
      interestTotal = round2(interestTotal + lateInterest);
    }

    const cashPayment = k === 0 ? 0 : minimumPaid.has(k) ? previousMin : previousBalance;
    const payments = round2(cashPayment + refundTotal);
    const balance = round2(previousBalance - payments + purchaseTotal + cashAdvanceTotal + interestTotal);
    const minPayment = round2(balance * 0.2);
    const limit = LIMITS[limitSteps.filter((s) => k >= s).length];

    const items = [
      piece('Ekstre tarihi', 40, 780),
      piece(`28/${month}/${year}`, 200, 780),
      piece('Son ödeme tarihi', 40, 766),
      piece(`08/${nextMonth}/${nextYear}`, 200, 766),
      piece('Kart numarası', 320, 766),
      piece('5400 **** **** 4417', 440, 766),
      piece('Minimum ödeme tutarı', 40, 752),
      piece(tl(minPayment), 200, 752),
      piece('Kart limiti', 320, 752),
      piece(tl(limit), 440, 752),
      piece('Kullanılabilir kart limiti', 320, 738),
      piece(tl(Math.max(limit - balance, 0)), 470, 738),
      ...[previousBalance, payments, purchaseTotal, cashAdvanceTotal, interestTotal, balance].map((n, j) =>
        piece(tl(n), 60 + j * 82, 706)
      ),
    ];

    let y = 676;
    const addRow = (day: number, description: string, amount: number, installment?: string) => {
      items.push(piece(`${pad2(day)}/${month}/${year}`, 50, y), piece(description, 200, y));
      if (installment) items.push(piece(installment, 420, y));
      items.push(piece(tl(amount), 455, y));
      y -= 13;
    };

    if (cashPayment > 0) addRow(5, 'Ödeme - Otomatik ödeme talimatı', -cashPayment);

    const byDay = (a: Entry, b: Entry) => a.day - b.day;
    for (const x of entries.filter((x) => !x.virtual).sort(byDay)) {
      addRow(x.day, x.description, x.amount, x.installment);
    }

    // Sanal kart blogu: ayristirici bu satiri gorunce sonraki islemleri
    // sanal karta yazar, "Sayfa n / m" satirinda ana karta geri doner.
    const virtualEntries = entries.filter((x) => x.virtual).sort(byDay);
    if (virtualEntries.length) {
      items.push(piece('5400 **** **** 9912 numaralı sanal kredi kartınızla yapılan işlemler', 50, y));
      y -= 13;
      for (const x of virtualEntries) addRow(x.day, x.description, x.amount, x.installment);
    }
    items.push(piece('Sayfa 1 / 1', 280, y - 8));

    out.push(parseEkstreRows([itemsToRows(items)], `ornek-${year}-${month}.pdf`));
    previousBalance = balance;
    previousMin = minPayment;
    paidMinimumLast = minimumPaid.has(k);
  }

  return out;
}
