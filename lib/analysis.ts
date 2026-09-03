import type { Ekstre, Transaction, TransactionKind } from './parseEkstre';

export const tl = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
export const tl0 = (n: number) => Math.round(n).toLocaleString('tr-TR') + ' ₺';

export const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

/** Ödemeler harcama degildir; iade ve ücretler net hesaba dahildir. */
export const isSpending = (i: Transaction) => i.kind !== 'payment';

export function allTransactions(statements: Ekstre[]): Transaction[] {
  return statements.flatMap((e) => e.transactions).sort((a, b) => a.date.localeCompare(b.date));
}

export interface CategoryTotal {
  category: string;
  amount: number;
  count: number;
  share: number;
}

export function categoryTotals(transactions: Transaction[]): CategoryTotal[] {
  const m = new Map<string, { amount: number; count: number }>();
  for (const i of transactions.filter(isSpending)) {
    const c = m.get(i.category) || { amount: 0, count: 0 };
    c.amount += i.amount;
    c.count += 1;
    m.set(i.category, c);
  }
  const total = [...m.values()].reduce((s, c) => s + c.amount, 0) || 1;
  return [...m.entries()]
    .map(([category, c]) => ({ category, ...c, share: (c.amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface StatementTotal {
  /** ayni donemde birden fazla kart olabilir; React anahtari icin */
  id: string;
  statement: string;
  cardNo: string | null;
  amount: number;
  balance: number | null;
  limit: number | null;
}

export function statementTotals(statements: Ekstre[]): StatementTotal[] {
  return statements.map((e) => ({
    id: e.id,
    statement: e.date,
    cardNo: e.cardNo,
    amount: e.transactions.filter(isSpending).reduce((s, i) => s + i.amount, 0),
    balance: e.summary.statementBalance,
    limit: e.cardLimit,
  }));
}

const CITIES =
  'ISTANBUL|ANKARA|IZMIR|KONYA|ESKISEHIR|BURSA|ANTALYA|ADANA|GAZIANTEP|KAYSERI|MERSIN|SAMSUN';

/**
 * Isyeri adini normalize eder ki ayni magazanin sube/sehir varyantlari tek
 * isim altinda toplansin: "MAVI JEANS-KONYA M1 KONYA TR" -> "MAVI JEANS".
 */
export function merchantName(description: string): string {
  let s = description;
  s = s.replace(/\((?:iade|[\d.,]+\s*(?:USD|EUR|GBP|TL))\)/gi, ' ');
  s = s.replace(/^(IYZICO|PARAM|PAYCELL|EPC|EPS)\s*[/*]\s*/i, ' ');
  s = s.replace(/[*]/g, ' ');
  s = s.replace(new RegExp(`-(?:${CITIES})\\b[\\w]*`, 'gi'), ' ');
  s = s.replace(new RegExp(`\\s+(?:${CITIES})\\b`, 'gi'), ' ');
  s = s.replace(/\s+TR\s*$/i, ' ');
  // karisik harf+rakam referans kodlari (Spotify P406F88763, A101 fis kodlari)
  s = s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{4,}\b/g, ' ');
  s = s.replace(/\b\d{4,}\b/g, ' ');
  s = s.replace(/\s+[A-Z]?\d{1,3}[A-Z]?\s*$/i, ' ');
  s = s.replace(/^[\s/\-]+/, '').replace(/\s+/g, ' ').trim();
  return s.toUpperCase();
}

export interface MerchantTotal {
  merchant: string;
  amount: number;
  count: number;
}

export function merchantTotals(transactions: Transaction[]): MerchantTotal[] {
  const m = new Map<string, { amount: number; count: number }>();
  for (const i of transactions.filter(isSpending)) {
    const name = merchantName(i.description);
    const c = m.get(name) || { amount: 0, count: 0 };
    c.amount += i.amount;
    c.count += 1;
    m.set(name, c);
  }
  return [...m.entries()]
    .map(([merchant, c]) => ({ merchant, ...c }))
    .sort((a, b) => b.amount - a.amount);
}

export interface Subscription {
  merchant: string;
  count: number;
  total: number;
  monthlyAverage: number;
  typicalAmount: number;
  lastDate: string;
  monthCount: number;
  parallelStreams: number;
  typicalDays: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Ayin gunlerini +-2 gun toleransla kumeler; ay sonu/basi sarmasini da hesaba katar. */
function dayClusters(days: number[]): number[][] {
  const clusters: number[][] = [];
  for (const g of [...days].sort((a, b) => a - b)) {
    const c = clusters.find((c) => {
      const d = Math.abs(c[0] - g);
      return Math.min(d, 31 - d) <= 2;
    });
    if (c) c.push(g);
    else clusters.push([g]);
  }
  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Aylik tekrar eden odemeleri bulur. Uc test birden gecmeli; her biri farkli
 * bir yanlis pozitifi eler ve gerekceleri asagida govdededir.
 *
 * `parallelStreams` > 1 ise ayni isyerinde es zamanli birden fazla abonelik doner.
 */
export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const groups = new Map<string, Transaction[]>();
  // Taksitli alisveris uc testi de geciyor (sabit tutar, ardisik ay, ayni gun)
  // ama abonelik degil: sonlu ve bitis tarihi belli. `installmentSchedule` gosteriyor.
  // Bu bir esik gevsetmesi degil, girdi kapsami daraltmasi.
  for (const i of transactions.filter((x) => x.kind === 'purchase' && !x.installment)) {
    const name = merchantName(i.description);
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(i);
  }

  const result: Subscription[] = [];

  for (const [merchant, list] of groups) {
    const months = new Map<string, number>();
    for (const i of list) {
      const month = i.date.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + 1);
    }
    if (months.size < 3) continue;

    const amounts = list.map((i) => i.amount);
    const med = median(amounts);
    if (med <= 0) continue;

    // Tutar istikrari: dagilim olcusu yerine "ayni tutar tekrarliyor mu".
    //
    // Neden degisti: medyandan global sapma olcusu uzun donemde zamlanan
    // abonelikleri kaybediyordu — Netflix bes yilda 63,99'dan 279,99'a
    // ciktiginda abonelik sayilmayi birakiyordu. Ara cozum olarak denenen
    // "ardisik degisimin medyani" ise az ornekte oynak cikti: ayda bir, ayin
    // ayni gunlerinde yapilan market/akaryakit alisverisi tesadufen esigin
    // altina dusebiliyordu.
    //
    // Bu olcu dogrudan aboneligin tanimini yakaliyor: fiyat degisene kadar
    // AYNI tutar tekrar eder. Basamakli zam birkac cifti bozar, gerisi birebir
    // aynidir; market alisverisinde ise hicbir ardisik cift ayni degildir.
    // Yanlis pozitif elemesi gevsemiyor, sertlesiyor.
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const changes: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].amount;
      if (prev > 0) changes.push(Math.abs(sorted[i].amount - prev) / prev);
    }
    if (changes.length < 2) continue;
    // %4 tolerans: dolar bazli abonelikte TL tutari kur kadar kayar.
    const sameRatio = changes.filter((d) => d <= 0.04).length / changes.length;
    if (sameRatio < 0.6) continue;
    // Tek bir uc deger seviyeyi temsil etmesin.
    if (Math.max(...amounts) > med * 3) continue;

    // Abonelikler ayin hep ayni gunu civarinda doner; dagilmis alisverisler donmez.
    const clusters = dayClusters(list.map((i) => Number(i.date.slice(8, 10))));
    const largestCluster = clusters[0]?.length ?? 0;
    if (largestCluster < 3 && largestCluster / list.length < 0.6) continue;

    const total = amounts.reduce((s, t) => s + t, 0);
    const streams = clusters.filter((c) => c.length >= 2);

    result.push({
      merchant,
      count: list.length,
      total,
      monthlyAverage: total / months.size,
      typicalAmount: med,
      lastDate: sorted[sorted.length - 1].date,
      monthCount: months.size,
      parallelStreams: Math.max(streams.length, 1),
      typicalDays: streams.map((c) => Math.round(median(c))).sort((a, b) => a - b),
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

export interface Overview {
  totalSpending: number;
  monthlyAverage: number;
  transactionCount: number;
  statementCount: number;
  topCategory: CategoryTotal | null;
  /** yalnizca ucu de `matched` olanlar; `unverifiable` ekstreler buna dahil DEGIL */
  allVerified: boolean;
  verificationCounts: { matched: number; mismatched: number; unverifiable: number };
}

export function overview(statements: Ekstre[]): Overview {
  const transactions = allTransactions(statements);
  const spending = transactions.filter(isSpending);
  const total = spending.reduce((s, i) => s + i.amount, 0);
  const categories = categoryTotals(transactions);
  return {
    totalSpending: total,
    monthlyAverage: statements.length ? total / statements.length : 0,
    transactionCount: spending.length,
    statementCount: statements.length,
    topCategory: categories[0] ?? null,
    allVerified: statements.length > 0 && statements.every((e) => e.verification.result === 'matched'),
    verificationCounts: {
      matched: statements.filter((e) => e.verification.result === 'matched').length,
      mismatched: statements.filter((e) => e.verification.result === 'mismatch').length,
      unverifiable: statements.filter((e) => e.verification.result === 'unverifiable').length,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Panel analizleri — hepsi saf: DOM, window, fetch yok.               *
 * ------------------------------------------------------------------ */

/**
 * Son n DONEMI dondurur — ekstre sayisini degil. Birden fazla kart varsa ayni
 * donemde birden fazla ekstre olur; "son 12" o durumda 12 ay demektir, 12
 * ekstre degil.
 */
export function lastPeriods(statements: Ekstre[], n: number | null): Ekstre[] {
  if (n === null) return statements;
  const periods = [...new Set(statements.map((e) => e.date))].sort();
  if (n >= periods.length) return statements;
  const kept = new Set(periods.slice(-n));
  return statements.filter((e) => kept.has(e.date));
}

export interface HeatCell {
  statement: string;
  amount: number;
  count: number;
  /** 0..1 — en yogun hucreye gore normalize edilmis renk yogunlugu */
  intensity: number;
}
export interface HeatRow {
  category: string;
  total: number;
  cells: HeatCell[];
}
export interface HeatMap {
  statements: string[];
  rows: HeatRow[];
  max: number;
}

/**
 * Kategori x ekstre matrisi. Hangi ayda hangi kalemin kabardigini tek bakista
 * gosterir; kategori sayisi 8'i astigi icin kategorik renk yerine tek tonlu
 * yogunluk kullanilir.
 */
export function heatMap(transactions: Transaction[]): HeatMap {
  const spending = transactions.filter(isSpending);
  const statements = [...new Set(spending.map((i) => i.statement))].sort();

  const matrix = new Map<string, Map<string, { amount: number; count: number }>>();
  for (const i of spending) {
    if (!matrix.has(i.category)) matrix.set(i.category, new Map());
    const row = matrix.get(i.category)!;
    const h = row.get(i.statement) ?? { amount: 0, count: 0 };
    h.amount += i.amount;
    h.count += 1;
    row.set(i.statement, h);
  }

  let max = 0;
  for (const row of matrix.values())
    for (const h of row.values()) max = Math.max(max, h.amount);

  const rows: HeatRow[] = [...matrix.entries()]
    .map(([category, row]) => ({
      category,
      total: [...row.values()].reduce((s, h) => s + h.amount, 0),
      cells: statements.map((e) => {
        const h = row.get(e) ?? { amount: 0, count: 0 };
        return {
          statement: e,
          amount: h.amount,
          count: h.count,
          intensity: max > 0 ? Math.max(h.amount, 0) / max : 0,
        };
      }),
    }))
    .sort((a, b) => b.total - a.total);

  return { statements, rows, max };
}

export interface AmountBucket {
  /** eksende gorunen kisa bicim — dar bantlarda cakismasin diye */
  label: string;
  /** ipucunda ve okuyucuda gecen acik bicim */
  fullLabel: string;
  count: number;
  amount: number;
}

const BUCKETS: Array<[string, string, number, number]> = [
  ['<250', '250 TL altı', 0, 250],
  ['250–1b', '250 – 1.000 TL', 250, 1000],
  ['1–2,5b', '1.000 – 2.500 TL', 1000, 2500],
  ['2,5–5b', '2.500 – 5.000 TL', 2500, 5000],
  ['5b+', '5.000 TL üzeri', 5000, Infinity],
];

/** Islem buyuklugu dagilimi: harcama profili cok kucuk mu, birkac buyuk kalem mi? */
export function amountDistribution(transactions: Transaction[]): AmountBucket[] {
  const result = BUCKETS.map(([label, fullLabel]) => ({ label, fullLabel, count: 0, amount: 0 }));
  for (const i of transactions.filter(isSpending)) {
    if (i.amount <= 0) continue;
    const k = BUCKETS.findIndex(([, , low, high]) => i.amount >= low && i.amount < high);
    if (k >= 0) {
      result[k].count += 1;
      result[k].amount += i.amount;
    }
  }
  return result;
}

export interface DayTotal {
  day: string;
  amount: number;
  count: number;
}

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Haftanin gunlerine gore harcama. Tarih ISO oldugu icin UTC ile okunur. */
export function weekdayDistribution(transactions: Transaction[]): DayTotal[] {
  const result = DAY_NAMES.map((day) => ({ day, amount: 0, count: 0 }));
  for (const i of transactions.filter(isSpending)) {
    const t = Date.parse(`${i.date}T00:00:00Z`);
    if (Number.isNaN(t)) continue;
    const idx = (new Date(t).getUTCDay() + 6) % 7; // pazartesi = 0
    result[idx].amount += i.amount;
    result[idx].count += 1;
  }
  return result;
}

export interface LimitRow {
  id: string;
  statement: string;
  balance: number | null;
  limit: number | null;
  available: number | null;
  /** balance / limit — ikisinden biri okunamadiysa null */
  ratio: number | null;
}

export function limitUsage(statements: Ekstre[]): LimitRow[] {
  return statements.map((e) => {
    const balance = e.summary.statementBalance;
    const limit = e.cardLimit;
    return {
      id: e.id,
      statement: e.date,
      balance,
      limit,
      available: e.availableLimit,
      ratio: balance !== null && limit !== null && limit > 0 ? balance / limit : null,
    };
  });
}

export interface InstallmentSummary {
  count: number;
  amount: number;
  /** taksitli harcamalarin toplam harcamaya orani, yuzde */
  share: number;
}

export function installmentSummary(transactions: Transaction[]): InstallmentSummary {
  const spending = transactions.filter(isSpending);
  const withInstallments = spending.filter((i) => i.installment);
  const total = spending.reduce((s, i) => s + i.amount, 0) || 1;
  const amount = withInstallments.reduce((s, i) => s + i.amount, 0);
  return { count: withInstallments.length, amount, share: (amount / total) * 100 };
}

export interface CalendarRow {
  merchant: string;
  monthlyAverage: number;
  cells: Array<{ statement: string; amount: number; count: number }>;
}

/** Abonelik x ekstre matrisi: hangi ay cekildi, hangi ay atladi. */
export function subscriptionCalendar(
  transactions: Transaction[],
  subscriptions: Subscription[]
): { statements: string[]; rows: CalendarRow[] } {
  const statements = [...new Set(transactions.filter(isSpending).map((i) => i.statement))].sort();
  const targets = new Map(subscriptions.map((a) => [a.merchant, a]));

  const matrix = new Map<string, Map<string, { amount: number; count: number }>>();
  for (const i of transactions.filter((x) => x.kind === 'purchase')) {
    const name = merchantName(i.description);
    if (!targets.has(name)) continue;
    if (!matrix.has(name)) matrix.set(name, new Map());
    const row = matrix.get(name)!;
    const h = row.get(i.statement) ?? { amount: 0, count: 0 };
    h.amount += i.amount;
    h.count += 1;
    row.set(i.statement, h);
  }

  return {
    statements,
    rows: subscriptions.map((a) => ({
      merchant: a.merchant,
      monthlyAverage: a.monthlyAverage,
      cells: statements.map((e) => {
        const h = matrix.get(a.merchant)?.get(e) ?? { amount: 0, count: 0 };
        return { statement: e, amount: h.amount, count: h.count };
      }),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Cikarimlar — ekstrede zaten yazan seylerden turetilen bulgular.      *
 * Yeni veri kaynagi yok; hepsi tarih, aciklama, tutar, taksit ve ozet  *
 * kutusundan cikiyor. Hepsi saf.                                       *
 * ------------------------------------------------------------------ */

const RE_INSTALLMENT_FIELD = /^(\d{1,2})\/(\d{1,2})$/;

/** "2025-03" + 2 -> "2025-05" */
function addMonths(month: string, n: number): string {
  const [y, a] = month.split('-').map(Number);
  const total = y * 12 + (a - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export interface InstallmentMonth {
  month: string;
  amount: number;
  count: number;
}
export interface InstallmentItem {
  merchant: string;
  /** donem basina cekilen taksit tutari */
  amount: number;
  remaining: number;
  totalInstallments: number;
  lastMonth: string;
}
export interface InstallmentForecast {
  months: InstallmentMonth[];
  items: InstallmentItem[];
  remainingTotal: number;
  lastMonth: string | null;
  openItems: number;
}

/**
 * Taksit alanindaki "3/6" ifadesi, ayni alisverisin 6 taksidinin 3.'sunun bu
 * donemde cekildigini soyler. Kalan taksitler henuz ekstrede gorunmez ama
 * tutari bellidir — ileriye dogru taahhut edilmis borc boyle cikarilir.
 *
 * Ayni alisveris ardisik ekstrelerde tekrar gorundugu icin (1/6, 2/6, 3/6)
 * isyeri + tutar + toplam taksit sayisina gore gruplanip en ilerideki taksit
 * esas alinir; aksi halde ayni borc birden cok kez sayilir.
 */
export function installmentSchedule(transactions: Transaction[]): InstallmentForecast {
  const groups = new Map<string, { k: number; n: number; amount: number; statement: string }>();

  for (const i of transactions) {
    if (!i.installment || i.kind !== 'purchase') continue;
    const m = RE_INSTALLMENT_FIELD.exec(i.installment);
    if (!m) continue;
    const k = Number(m[1]);
    const n = Number(m[2]);
    if (!(n > 1) || !(k >= 1) || k > n) continue;

    const key = `${merchantName(i.description)}|${i.amount.toFixed(2)}|${n}`;
    const prev = groups.get(key);
    if (!prev || k > prev.k) groups.set(key, { k, n, amount: i.amount, statement: i.statement });
  }

  const months = new Map<string, { amount: number; count: number }>();
  const items: InstallmentItem[] = [];
  let remainingTotal = 0;

  for (const [key, g] of groups) {
    const remaining = g.n - g.k;
    if (remaining <= 0) continue;
    const base = g.statement.slice(0, 7);
    for (let j = 1; j <= remaining; j++) {
      const month = addMonths(base, j);
      const h = months.get(month) ?? { amount: 0, count: 0 };
      h.amount += g.amount;
      h.count += 1;
      months.set(month, h);
      remainingTotal += g.amount;
    }
    items.push({
      merchant: key.split('|')[0],
      amount: g.amount,
      remaining,
      totalInstallments: g.n,
      lastMonth: addMonths(base, remaining),
    });
  }

  const sorted = [...months.entries()]
    .map(([month, h]) => ({ month, ...h }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    months: sorted,
    items: items.sort((a, b) => b.amount * b.remaining - a.amount * a.remaining),
    remainingTotal: round2(remainingTotal),
    lastMonth: sorted.length ? sorted[sorted.length - 1].month : null,
    openItems: items.length,
  };
}

export interface FixedLoad {
  subscriptions: number;
  installments: number;
  bills: number;
  fixed: number;
  variable: number;
  /** fixed'in toplama orani, yuzde */
  share: number;
}

/**
 * "Sen hicbir sey yapmasan da cikacak para" ayrimi: abonelikler, taksit
 * borclari ve faturalar sabit; gerisi degisken.
 */
export function fixedLoad(transactions: Transaction[], subs: Subscription[]): FixedLoad {
  const subNames = new Set(subs.map((a) => a.merchant));
  let subscriptions = 0;
  let installments = 0;
  let bills = 0;
  let variable = 0;

  for (const i of transactions.filter(isSpending)) {
    if (subNames.has(merchantName(i.description))) subscriptions += i.amount;
    else if (i.installment) installments += i.amount;
    else if (i.category === 'Fatura & telekom') bills += i.amount;
    else variable += i.amount;
  }

  const fixed = subscriptions + installments + bills;
  const total = fixed + variable || 1;
  return {
    subscriptions: round2(subscriptions),
    installments: round2(installments),
    bills: round2(bills),
    fixed: round2(fixed),
    variable: round2(variable),
    share: (fixed / total) * 100,
  };
}

export interface InterestSummary {
  /** bankanin ozet kutusunda yazdigi faiz + vergi toplami */
  total: number;
  periods: number;
  items: Transaction[];
  /** odemesi asgari tutara denk gelen ekstreler — borc sarmali isareti */
  minimumPaid: string[];
}

export function interestAndFees(statements: Ekstre[]): InterestSummary {
  let total = 0;
  let periods = 0;
  const minimumPaid: string[] = [];

  for (let i = 0; i < statements.length; i++) {
    const e = statements[i];
    const f = e.summary.interestAndTax;
    if (f !== null && f > 0) {
      total += f;
      periods += 1;
    }
    // Bu donemde yapilan odeme, BIR ONCEKI ekstrenin asgarisini kapatir.
    const prev = statements[i - 1];
    const paid = e.summary.payments;
    const min = prev?.minPayment ?? null;
    if (paid !== null && min !== null && min > 0 && Math.abs(paid - min) <= min * 0.02) {
      minimumPaid.push(e.date);
    }
  }

  const items = statements
    .flatMap((e) => e.transactions)
    .filter((i) => i.kind === 'fee' || i.kind === 'cashAdvance');

  return { total: round2(total), periods, items, minimumPaid };
}

export interface DuplicateCharge {
  merchant: string;
  date: string;
  amount: number;
  count: number;
}

/** Ayni gun, ayni isyeri, ayni tutar birden fazla kez: olasi mukerrer cekim. */
export function possibleDuplicateCharges(transactions: Transaction[]): DuplicateCharge[] {
  const m = new Map<string, DuplicateCharge>();
  for (const i of transactions.filter((x) => x.kind === 'purchase')) {
    if (i.amount <= 0) continue;
    const merchant = merchantName(i.description);
    const key = `${i.date}|${merchant}|${i.amount.toFixed(2)}`;
    const h = m.get(key) ?? { merchant, date: i.date, amount: i.amount, count: 0 };
    h.count += 1;
    m.set(key, h);
  }
  return [...m.values()].filter((c) => c.count > 1).sort((a, b) => b.amount * b.count - a.amount * a.count);
}

export interface Outlier {
  merchant: string;
  date: string;
  amount: number;
  usual: number;
}

/**
 * Bir isyerinde her zamankinin cok uzerinde tek bir harcama. Esikler abonelik
 * tespitindeki mantikla ayni: medyan referans, mutlak taban yanlis pozitifi eler.
 */
export function outliers(transactions: Transaction[], minCount = 4): Outlier[] {
  const groups = new Map<string, Transaction[]>();
  for (const i of transactions.filter((x) => x.kind === 'purchase' && x.amount > 0)) {
    const name = merchantName(i.description);
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(i);
  }

  const result: Outlier[] = [];
  for (const [merchant, list] of groups) {
    if (list.length < minCount) continue;
    const med = median(list.map((i) => i.amount));
    if (med <= 0) continue;
    for (const i of list) {
      if (i.amount >= med * 2.5 && i.amount - med >= 500) {
        result.push({ merchant, date: i.date, amount: i.amount, usual: med });
      }
    }
  }
  return result.sort((a, b) => b.amount - b.usual - (a.amount - a.usual));
}

export interface PriceIncrease {
  merchant: string;
  before: number;
  after: number;
  statement: string;
  monthlyDelta: number;
}

/**
 * Abonelik tutarinin kalici olarak degistigi an. Donem basina TOPLAM tutar
 * kiyaslanir ama yalnizca cekim SAYISI ayni olan donemler arasinda — boylece
 * "bu ay iki kez cekildi" zam sanilmaz.
 */
export function subscriptionPriceIncreases(
  transactions: Transaction[],
  subscriptions: Subscription[]
): PriceIncrease[] {
  const targets = new Set(subscriptions.map((a) => a.merchant));
  const periods = new Map<string, Map<string, { amount: number; count: number }>>();

  for (const i of transactions.filter((x) => x.kind === 'purchase')) {
    const name = merchantName(i.description);
    if (!targets.has(name)) continue;
    if (!periods.has(name)) periods.set(name, new Map());
    const d = periods.get(name)!;
    const h = d.get(i.statement) ?? { amount: 0, count: 0 };
    h.amount += i.amount;
    h.count += 1;
    d.set(i.statement, h);
  }

  const result: PriceIncrease[] = [];
  for (const [merchant, d] of periods) {
    const sorted = [...d.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1][1];
      const curr = sorted[i][1];
      if (prev.count !== curr.count || prev.amount <= 0) continue;
      const ratio = curr.amount / prev.amount - 1;
      if (Math.abs(ratio) < 0.05) continue;
      // Yeni seviye sonraki tum donemlerde de korunuyorsa kalici degisimdir.
      const permanent = sorted
        .slice(i + 1)
        .every(([, h]) => h.count !== curr.count || Math.abs(h.amount / curr.amount - 1) < 0.05);
      if (!permanent) continue;
      result.push({
        merchant,
        before: round2(prev.amount),
        after: round2(curr.amount),
        statement: sorted[i][0],
        monthlyDelta: round2(curr.amount - prev.amount),
      });
      break;
    }
  }
  return result.sort((a, b) => Math.abs(b.monthlyDelta) - Math.abs(a.monthlyDelta));
}

export interface StoppedSubscription {
  merchant: string;
  lastStatement: string;
  monthlyAmount: number;
  skippedPeriods: number;
}

/** Duzenli donerken son donemlerde hic gorunmeyen abonelik. */
export function stoppedSubscriptions(
  transactions: Transaction[],
  subscriptions: Subscription[],
  minSkipped = 2
): StoppedSubscription[] {
  const calendar = subscriptionCalendar(transactions, subscriptions);
  const result: StoppedSubscription[] = [];

  for (const s of calendar.rows) {
    let skipped = 0;
    for (let i = s.cells.length - 1; i >= 0; i--) {
      if (s.cells[i].count > 0) break;
      skipped += 1;
    }
    if (skipped < minSkipped) continue;
    const lastActive = [...s.cells].reverse().find((h) => h.count > 0);
    if (!lastActive) continue;
    result.push({
      merchant: s.merchant,
      lastStatement: lastActive.statement,
      monthlyAmount: s.monthlyAverage,
      skippedPeriods: skipped,
    });
  }
  return result.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export interface CurrencyTotal {
  currency: string;
  foreignTotal: number;
  tryTotal: number;
  count: number;
  firstRate: number;
  lastRate: number;
  /** ilk donemden son doneme efektif kur artisi, yuzde */
  rateIncrease: number;
}
export interface RatePoint {
  statement: string;
  currency: string;
  rate: number;
}
export interface ForeignSpending {
  tryTotal: number;
  count: number;
  /** yurt disi harcamanin toplam harcamaya orani, yuzde */
  share: number;
  currencies: CurrencyTotal[];
  trend: RatePoint[];
}

/**
 * Yurt disi harcamalar. Ekstre hem TL tutarini hem yabanci para tutarini
 * yazdigi icin efektif kur (komisyon dahil) bolmeyle bulunuyor — bankanin
 * ayrica bildirmedigi bir rakam.
 */
export function foreignSpending(transactions: Transaction[]): ForeignSpending {
  const spending = transactions.filter(isSpending);
  const foreignTx = spending.filter((i) => i.foreign && i.foreign.amount > 0 && i.amount > 0);

  const totalSpending = spending.reduce((s, i) => s + i.amount, 0) || 1;
  const groups = new Map<string, Transaction[]>();
  for (const i of foreignTx) {
    const b = i.foreign!.currency;
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(i);
  }

  // Donem + birim basina ortalama efektif kur
  const trendMap = new Map<string, { tryTotal: number; foreignTotal: number }>();
  for (const i of foreignTx) {
    const key = `${i.statement}|${i.foreign!.currency}`;
    const h = trendMap.get(key) ?? { tryTotal: 0, foreignTotal: 0 };
    h.tryTotal += i.amount;
    h.foreignTotal += i.foreign!.amount;
    trendMap.set(key, h);
  }
  const trend: RatePoint[] = [...trendMap.entries()]
    .map(([key, h]) => {
      const [statement, currency] = key.split('|');
      return { statement, currency, rate: round2(h.tryTotal / h.foreignTotal) };
    })
    .sort((a, b) => a.statement.localeCompare(b.statement) || a.currency.localeCompare(b.currency));

  const currencies: CurrencyTotal[] = [...groups.entries()]
    .map(([currency, list]) => {
      const series = trend.filter((s) => s.currency === currency);
      const firstRate = series[0]?.rate ?? 0;
      const lastRate = series[series.length - 1]?.rate ?? 0;
      return {
        currency,
        foreignTotal: round2(list.reduce((s, i) => s + i.foreign!.amount, 0)),
        tryTotal: round2(list.reduce((s, i) => s + i.amount, 0)),
        count: list.length,
        firstRate,
        lastRate,
        rateIncrease: firstRate > 0 ? (lastRate / firstRate - 1) * 100 : 0,
      };
    })
    .sort((a, b) => b.tryTotal - a.tryTotal);

  const tryTotal = round2(currencies.reduce((s, b) => s + b.tryTotal, 0));
  return {
    tryTotal,
    count: foreignTx.length,
    share: (tryTotal / totalSpending) * 100,
    currencies,
    trend,
  };
}

export interface LimitChange {
  statement: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Kart limiti her ekstrede yaziyor; ardisik ekstreler kiyaslaninca limitin ne
 * zaman ve ne kadar degistigi kendiliginden cikiyor. Bankanin ayrica
 * bildirmedigi bir bilgi degil ama hicbir yerde tek listede gorunmuyor.
 */
export function limitChanges(statements: Ekstre[]): LimitChange[] {
  const result: LimitChange[] = [];
  const withLimit = statements.filter((e) => e.cardLimit !== null);
  for (let i = 1; i < withLimit.length; i++) {
    const before = withLimit[i - 1].cardLimit!;
    const after = withLimit[i].cardLimit!;
    if (before === after || before <= 0) continue;
    result.push({ statement: withLimit[i].date, before, after, delta: round2(after - before) });
  }
  return result;
}

export interface CategoryChange {
  category: string;
  before: number;
  after: number;
  percent: number;
}

/**
 * Son iki donem arasinda en cok kipirdayan kategoriler.
 *
 * Yalnizca *yerlesik* kategoriler kiyaslanir: kategori en az uc donemde
 * gorunmeli ve iki donemde de anlamli tutar tasimali. Aksi halde "o ay hic
 * alisveris yapilmayan" seyrek bir kategori %-100 degisim olarak listenin
 * basina cikiyor ve gercek bulgulari asagi itiyor.
 */
export function categoryChanges(transactions: Transaction[], minAmount = 300): CategoryChange[] {
  const spending = transactions.filter(isSpending);
  const periods = [...new Set(spending.map((i) => i.statement))].sort();
  if (periods.length < 2) return [];
  const [prev, curr] = [periods[periods.length - 2], periods[periods.length - 1]];

  const seenIn = new Map<string, Set<string>>();
  for (const i of spending) {
    if (!seenIn.has(i.category)) seenIn.set(i.category, new Set());
    seenIn.get(i.category)!.add(i.statement);
  }

  const totalsFor = (statement: string) => {
    const m = new Map<string, number>();
    for (const i of spending) {
      if (i.statement === statement) m.set(i.category, (m.get(i.category) ?? 0) + i.amount);
    }
    return m;
  };

  const a = totalsFor(prev);
  const b = totalsFor(curr);
  const result: CategoryChange[] = [];
  for (const category of new Set([...a.keys(), ...b.keys()])) {
    // "Diger" bir kategori degil, artik kutusu — hakkinda bulgu uretmek anlamsiz.
    if (category === 'Diğer') continue;
    if ((seenIn.get(category)?.size ?? 0) < 3) continue;
    const before = a.get(category) ?? 0;
    const after = b.get(category) ?? 0;
    if (before < minAmount || after < minAmount) continue;
    if (Math.abs(after - before) < minAmount) continue;
    const percent = (after / before - 1) * 100;
    if (Math.abs(percent) < 20) continue; // hem mutlak hem oransal esik
    result.push({ category, before: round2(before), after: round2(after), percent });
  }
  return result.sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before));
}

/** "GG/AA/YYYY" -> gun sayisi (epoch). Bozuk girdide null. */
function dayNumber(ddmmyyyy: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) / 86_400_000);
}
function isoDayNumber(iso: string): number | null {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor(t / 86_400_000);
}

export interface GraceDayBucket {
  day: number;
  averageDays: number;
  count: number;
}
export interface GracePeriod {
  average: number;
  /** buyuk harcamalarin (threshold ustu) ortalamasi */
  largeAverage: number;
  largeCount: number;
  threshold: number;
  bestDay: number;
  worstDay: number;
  /** buyuk harcamalari en iyi gune kaydirinca kazanilacak gun */
  gain: number;
  distribution: GraceDayBucket[];
}

/**
 * Faizsiz kullanim suresi.
 *
 * Ekstre kesim tarihi ile son odeme tarihi arasindaki bosluk, harcamanin
 * yapildigi gune gore degisen bir bedava kredi suresi yaratir: kesimden hemen
 * sonraki harcama bir sonraki ekstreye duser ve neredeyse iki ay sonra odenir;
 * kesime yakin yapilan ayni harcama on gun icinde odenir.
 *
 * `dueDate` bugune kadar hic kullanilmayan bir alandi.
 */
export function gracePeriod(statements: Ekstre[], threshold = 2500): GracePeriod | null {
  const measured: Array<{ day: number; graceDays: number; amount: number }> = [];

  for (const e of statements) {
    if (!e.dueDate) continue;
    const due = dayNumber(e.dueDate);
    if (due === null) continue;
    for (const i of e.transactions) {
      if (i.kind !== 'purchase' || i.amount <= 0) continue;
      const g = isoDayNumber(i.date);
      if (g === null) continue;
      const graceDays = due - g;
      if (graceDays < 0 || graceDays > 120) continue; // bozuk tarih koruması
      measured.push({ day: Number(i.date.slice(8, 10)), graceDays, amount: i.amount });
    }
  }

  if (measured.length < 10) return null;

  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const average = avg(measured.map((o) => o.graceDays));
  const large = measured.filter((o) => o.amount >= threshold);
  const largeAverage = avg(large.map((o) => o.graceDays));

  const days = new Map<number, number[]>();
  for (const o of measured) {
    if (!days.has(o.day)) days.set(o.day, []);
    days.get(o.day)!.push(o.graceDays);
  }
  const distribution = [...days.entries()]
    .map(([day, s]) => ({ day, averageDays: round2(avg(s)), count: s.length }))
    .sort((a, b) => a.day - b.day);

  const ranked = [...distribution].sort((a, b) => b.averageDays - a.averageDays);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return {
    average: round2(average),
    largeAverage: round2(largeAverage),
    largeCount: large.length,
    threshold,
    bestDay: best?.day ?? 0,
    worstDay: worst?.day ?? 0,
    gain: large.length ? round2((best?.averageDays ?? 0) - largeAverage) : 0,
    distribution,
  };
}

export interface RefundByMerchant {
  merchant: string;
  refund: number;
  purchases: number;
  ratio: number;
  count: number;
}
export interface Refunds {
  total: number;
  count: number;
  /** iadelerin brut harcamaya orani, yuzde */
  ratio: number;
  merchants: RefundByMerchant[];
}

/** Iadeler bugune kadar net toplama giriyordu ama hicbir yerde raporlanmiyordu. */
export function refundAnalysis(transactions: Transaction[]): Refunds {
  const refunds = transactions.filter((i) => i.kind === 'refund');
  const gross = transactions.filter((i) => i.kind === 'purchase').reduce((s, i) => s + i.amount, 0) || 1;

  const purchaseTotals = new Map<string, number>();
  for (const i of transactions.filter((x) => x.kind === 'purchase')) {
    const name = merchantName(i.description);
    purchaseTotals.set(name, (purchaseTotals.get(name) ?? 0) + i.amount);
  }

  const m = new Map<string, { refund: number; count: number }>();
  for (const i of refunds) {
    const name = merchantName(i.description);
    const h = m.get(name) ?? { refund: 0, count: 0 };
    h.refund += Math.abs(i.amount);
    h.count += 1;
    m.set(name, h);
  }

  const total = round2(refunds.reduce((s, i) => s + Math.abs(i.amount), 0));
  return {
    total,
    count: refunds.length,
    ratio: (total / gross) * 100,
    merchants: [...m.entries()]
      .map(([merchant, h]) => {
        const purchases = purchaseTotals.get(merchant) ?? 0;
        return {
          merchant,
          refund: round2(h.refund),
          purchases: round2(purchases),
          ratio: purchases > 0 ? (h.refund / purchases) * 100 : 0,
          count: h.count,
        };
      })
      .sort((a, b) => b.refund - a.refund),
  };
}

export interface CashAdvanceSummary {
  amount: number;
  count: number;
  /** ayni donemlerdeki ucret ve faiz satirlari */
  fees: number;
  statements: string[];
}

/** Kredi kartinin en pahali kullanim bicimi — ayri ve gorunur olmali. */
export function cashAdvanceAnalysis(statements: Ekstre[]): CashAdvanceSummary {
  const transactions = statements.flatMap((e) => e.transactions);
  const advances = transactions.filter((i) => i.kind === 'cashAdvance');
  const periods = new Set(advances.map((i) => i.statement));
  const fees = transactions.filter((i) => i.kind === 'fee' && periods.has(i.statement));

  return {
    amount: round2(advances.reduce((s, i) => s + Math.abs(i.amount), 0)),
    count: advances.length,
    fees: round2(fees.reduce((s, i) => s + i.amount, 0)),
    statements: [...periods].sort(),
  };
}

export interface CardSplit {
  main: { amount: number; count: number };
  virtual: { amount: number; count: number };
  /** sanal kart harcamasinin toplama orani, yuzde */
  virtualShare: number;
}

export function cardSplit(transactions: Transaction[]): CardSplit {
  const tally = (card: 'main' | 'virtual') => {
    const l = transactions.filter((i) => isSpending(i) && i.card === card);
    return { amount: round2(l.reduce((s, i) => s + i.amount, 0)), count: l.length };
  };
  const main = tally('main');
  const virtual = tally('virtual');
  const total = main.amount + virtual.amount || 1;
  return { main, virtual, virtualShare: (virtual.amount / total) * 100 };
}

export type PaymentState = 'full' | 'partial' | 'minimum';
export interface PaymentRow {
  statement: string;
  previousBalance: number;
  paid: number;
  ratio: number;
  state: PaymentState;
}
export interface PaymentDiscipline {
  periods: number;
  full: number;
  partial: number;
  minimum: number;
  /** tam odenen donemlerin orani, yuzde */
  ratio: number;
  rows: PaymentRow[];
}

/**
 * Odeme karnesi. Bir donemde yapilan odeme bir onceki ekstrenin borcunu
 * kapatir; oran oradan cikar. Iadeler odeme sayilmasin diye ozet alani yerine
 * dogrudan `payment` tipli islemler toplanir.
 */
export function paymentDiscipline(statements: Ekstre[]): PaymentDiscipline {
  const rows: PaymentRow[] = [];

  for (let i = 1; i < statements.length; i++) {
    const prev = statements[i - 1];
    const balance = prev.summary.statementBalance;
    if (balance === null || balance <= 0) continue;

    const paid = round2(
      statements[i].transactions.filter((x) => x.kind === 'payment').reduce((s, x) => s + Math.abs(x.amount), 0)
    );
    const ratio = (paid / balance) * 100;
    const min = prev.minPayment;
    const state: PaymentState =
      ratio >= 99
        ? 'full'
        : min !== null && min > 0 && Math.abs(paid - min) <= min * 0.02
          ? 'minimum'
          : 'partial';

    rows.push({ statement: statements[i].date, previousBalance: balance, paid, ratio, state });
  }

  const count = (state: PaymentState) => rows.filter((r) => r.state === state).length;
  const full = count('full');
  return {
    periods: rows.length,
    full,
    partial: count('partial'),
    minimum: count('minimum'),
    ratio: rows.length ? (full / rows.length) * 100 : 0,
    rows,
  };
}

export interface Habit {
  merchant: string;
  count: number;
  monthCount: number;
  /** ayda kac kez */
  monthlyFrequency: number;
  total: number;
  monthlyAverage: number;
  averageAmount: number;
}

/**
 * Abonelik tespitinin bilincli kor noktasi: tutari sabit degil ama SIKLIGI
 * sabit olan harcamalar. Haftada uc kahve abonelik degildir, ama yillik
 * toplami bir abonelikten buyuk olabilir.
 */
export function habits(
  transactions: Transaction[],
  subscriptions: Subscription[],
  minFrequency = 1.5
): Habit[] {
  const subNames = new Set(subscriptions.map((a) => a.merchant));
  const groups = new Map<string, Transaction[]>();
  for (const i of transactions.filter((x) => x.kind === 'purchase' && !x.installment && x.amount > 0)) {
    const name = merchantName(i.description);
    if (!name || subNames.has(name)) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(i);
  }

  const result: Habit[] = [];
  for (const [merchant, list] of groups) {
    const months = new Set(list.map((i) => i.date.slice(0, 7)));
    if (months.size < 3) continue;
    const frequency = list.length / months.size;
    if (frequency < minFrequency) continue;
    const total = list.reduce((s, i) => s + i.amount, 0);
    result.push({
      merchant,
      count: list.length,
      monthCount: months.size,
      monthlyFrequency: round2(frequency),
      total: round2(total),
      monthlyAverage: round2(total / months.size),
      averageAmount: round2(total / list.length),
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

export interface MerchantChurn {
  added: Array<{ merchant: string; amount: number; count: number }>;
  dropped: Array<{ merchant: string; lastStatement: string; monthlyAverage: number; skipped: number }>;
}

/** Son donemde ilk kez gorunen ve artik hic gorunmeyen isyerleri. */
export function merchantChurn(transactions: Transaction[], dropThreshold = 3): MerchantChurn {
  // Taksitli alisveris haric: taksiti biten bir magaza "terk edilmis isyeri"
  // degil, suresi dolmus bir odeme plani. `installmentSchedule` zaten gosteriyor.
  const spending = transactions.filter((i) => i.kind === 'purchase' && i.amount > 0 && !i.installment);
  const periods = [...new Set(spending.map((i) => i.statement))].sort();
  if (periods.length < 4) return { added: [], dropped: [] };
  const last = periods[periods.length - 1];

  const seen = new Map<string, { periods: Set<string>; total: number; lastAmount: number; lastCount: number }>();
  for (const i of spending) {
    const name = merchantName(i.description);
    if (!name) continue;
    const h = seen.get(name) ?? { periods: new Set<string>(), total: 0, lastAmount: 0, lastCount: 0 };
    h.periods.add(i.statement);
    h.total += i.amount;
    if (i.statement === last) {
      h.lastAmount += i.amount;
      h.lastCount += 1;
    }
    seen.set(name, h);
  }

  const added: MerchantChurn['added'] = [];
  const dropped: MerchantChurn['dropped'] = [];

  for (const [merchant, h] of seen) {
    const sorted = [...h.periods].sort();
    if (sorted.length === 1 && sorted[0] === last) {
      added.push({ merchant, amount: round2(h.lastAmount), count: h.lastCount });
      continue;
    }
    const lastSeen = sorted[sorted.length - 1];
    const skipped = periods.length - 1 - periods.indexOf(lastSeen);
    // Duzenli gelenler icin anlamli: en az uc donemde gorunmus olsun
    if (skipped >= dropThreshold && sorted.length >= 3) {
      dropped.push({
        merchant,
        lastStatement: lastSeen,
        monthlyAverage: round2(h.total / sorted.length),
        skipped,
      });
    }
  }

  return {
    added: added.sort((a, b) => b.amount - a.amount),
    dropped: dropped.sort((a, b) => b.monthlyAverage - a.monthlyAverage),
  };
}

/**
 * Bulgu — arayuze yapisal veri doner, cumleyi bilesen kurar. lib katmani
 * sunum metni uretmez.
 */
export type Finding =
  | { kind: 'unverified'; score: number; mismatched: number; unverifiable: number; total: number }
  | { kind: 'interest'; score: number; total: number; periods: number }
  | { kind: 'cash-advance'; score: number; amount: number; fees: number; statements: string[] }
  | { kind: 'minimum-payment'; score: number; statements: string[] }
  | { kind: 'grace-day'; score: number; average: number; largeAverage: number; bestDay: number; gain: number; threshold: number }
  | { kind: 'habit'; score: number; merchant: string; monthlyFrequency: number; total: number; monthlyAverage: number }
  | { kind: 'payment-discipline'; score: number; full: number; periods: number; ratio: number }
  | { kind: 'foreign'; score: number; tryTotal: number; share: number; currency: string; rateIncrease: number }
  | { kind: 'refund'; score: number; total: number; count: number; topMerchant: string; topRatio: number }
  | { kind: 'installment-load'; score: number; remainingTotal: number; lastMonth: string; openItems: number }
  | { kind: 'price-increase'; score: number; merchant: string; before: number; after: number; statement: string; monthlyDelta: number }
  | { kind: 'stopped-subscription'; score: number; merchant: string; lastStatement: string; monthlyAmount: number }
  | { kind: 'duplicate-charge'; score: number; merchant: string; date: string; amount: number; count: number }
  | { kind: 'outlier'; score: number; merchant: string; date: string; amount: number; usual: number }
  | { kind: 'fixed-load'; score: number; fixed: number; share: number }
  | { kind: 'limit-change'; score: number; statement: string; before: number; after: number; delta: number }
  | { kind: 'category-change'; score: number; category: string; before: number; after: number; percent: number };

/**
 * Bulgu turlerinin oncelik basamaklari.
 *
 * Siralamayi salt TL buyuklugune birakmak yaniltiyor: 500 TL'lik faiz, bir
 * kategorinin 7.000 TL'lik olagan dalgalanmasindan daha onemlidir. Once
 * "parani yakan" bulgular, sonra taahhutler, en sonda baglam gelir; tutar
 * yalnizca ayni basamak icinde siralar.
 */
const FINDING_TIER: Record<Finding['kind'], number> = {
  // Rakamlara guvenilip guvenilemeyecegi her seyin onunde gelir.
  unverified: 100,
  'cash-advance': 95,
  interest: 90,
  'minimum-payment': 80,
  'duplicate-charge': 70,
  'price-increase': 60,
  'stopped-subscription': 50,
  'grace-day': 45,
  'installment-load': 40,
  habit: 35,
  outlier: 30,
  'payment-discipline': 25,
  'fixed-load': 20,
  foreign: 18,
  'limit-change': 15,
  refund: 12,
  'category-change': 10,
};

const score = (kind: Finding['kind'], amount: number) =>
  FINDING_TIER[kind] * 100_000 + Math.min(Math.abs(amount), 99_999);

/** Tum cikarimlari tek listede toplar; basamak, sonra tutar sirasiyla. */
export function findings(statements: Ekstre[], subscriptions: Subscription[]): Finding[] {
  const transactions = allTransactions(statements);
  const out: Finding[] = [];

  // Once guven: asagidaki her rakam bu ekstrelerden turedigi icin, bir ekstre
  // dogrulanamiyorsa bunu bilmek diger tum bulgulardan onemlidir.
  const mismatched = statements.filter((e) => e.verification.result === 'mismatch').length;
  const unverifiable = statements.filter((e) => e.verification.result === 'unverifiable').length;
  if (mismatched > 0 || unverifiable > 0) {
    out.push({
      kind: 'unverified',
      score: score('unverified', mismatched * 1000 + unverifiable),
      mismatched,
      unverifiable,
      total: statements.length,
    });
  }

  const advance = cashAdvanceAnalysis(statements);
  if (advance.amount > 0) {
    out.push({
      kind: 'cash-advance',
      score: score('cash-advance', advance.amount),
      amount: advance.amount,
      fees: advance.fees,
      statements: advance.statements,
    });
  }

  const interest = interestAndFees(statements);
  if (interest.total > 0) {
    out.push({ kind: 'interest', score: score('interest', interest.total), total: interest.total, periods: interest.periods });
  }

  const grace = gracePeriod(statements);
  if (grace && grace.largeCount >= 3 && grace.gain >= 5) {
    out.push({
      kind: 'grace-day',
      score: score('grace-day', grace.gain * 100),
      average: grace.average,
      largeAverage: grace.largeAverage,
      bestDay: grace.bestDay,
      gain: grace.gain,
      threshold: grace.threshold,
    });
  }

  const discipline = paymentDiscipline(statements);
  if (discipline.periods >= 3) {
    out.push({
      kind: 'payment-discipline',
      score: score('payment-discipline', discipline.periods - discipline.full),
      full: discipline.full,
      periods: discipline.periods,
      ratio: discipline.ratio,
    });
  }

  const fx = foreignSpending(transactions);
  if (fx.tryTotal > 0 && fx.currencies.length) {
    const b = fx.currencies[0];
    out.push({
      kind: 'foreign',
      score: score('foreign', fx.tryTotal),
      tryTotal: fx.tryTotal,
      share: fx.share,
      currency: b.currency,
      rateIncrease: b.rateIncrease,
    });
  }

  const refunds = refundAnalysis(transactions);
  if (refunds.total > 0 && refunds.merchants.length) {
    out.push({
      kind: 'refund',
      score: score('refund', refunds.total),
      total: refunds.total,
      count: refunds.count,
      topMerchant: refunds.merchants[0].merchant,
      topRatio: refunds.merchants[0].ratio,
    });
  }

  for (const a of habits(transactions, subscriptions).slice(0, 2)) {
    out.push({
      kind: 'habit',
      score: score('habit', a.total),
      merchant: a.merchant,
      monthlyFrequency: a.monthlyFrequency,
      total: a.total,
      monthlyAverage: a.monthlyAverage,
    });
  }
  if (interest.minimumPaid.length) {
    out.push({
      kind: 'minimum-payment',
      score: score('minimum-payment', interest.minimumPaid.length),
      statements: interest.minimumPaid,
    });
  }

  const installments = installmentSchedule(transactions);
  if (installments.remainingTotal > 0 && installments.lastMonth) {
    out.push({
      kind: 'installment-load',
      score: score('installment-load', installments.remainingTotal),
      remainingTotal: installments.remainingTotal,
      lastMonth: installments.lastMonth,
      openItems: installments.openItems,
    });
  }

  for (const z of subscriptionPriceIncreases(transactions, subscriptions)) {
    out.push({ kind: 'price-increase', score: score('price-increase', z.monthlyDelta * 12), ...z });
  }

  for (const d of stoppedSubscriptions(transactions, subscriptions)) {
    out.push({
      kind: 'stopped-subscription',
      score: score('stopped-subscription', d.monthlyAmount),
      merchant: d.merchant,
      lastStatement: d.lastStatement,
      monthlyAmount: d.monthlyAmount,
    });
  }

  for (const c of possibleDuplicateCharges(transactions).slice(0, 5)) {
    out.push({ kind: 'duplicate-charge', score: score('duplicate-charge', c.amount * (c.count - 1)), ...c });
  }

  for (const s of outliers(transactions).slice(0, 5)) {
    out.push({ kind: 'outlier', score: score('outlier', s.amount - s.usual), ...s });
  }

  const load = fixedLoad(transactions, subscriptions);
  if (load.fixed > 0) {
    out.push({ kind: 'fixed-load', score: score('fixed-load', load.fixed), fixed: load.fixed, share: load.share });
  }

  for (const l of limitChanges(statements)) {
    out.push({ kind: 'limit-change', score: score('limit-change', l.delta), ...l });
  }

  for (const k of categoryChanges(transactions).slice(0, 3)) {
    out.push({ kind: 'category-change', score: score('category-change', k.after - k.before), ...k });
  }

  return out.sort((a, b) => b.score - a.score);
}

/**
 * CSV kullaniciya giden bir dosya: basliklari gibi hucre degerleri de Turkce
 * kalmali. Tanimlayicilar Ingilizce'ye cevrilirken `kind` ve `card` degerleri
 * de Ingilizce olmustu; bu iki harita cikti dilini eski haline sabitler.
 */
const CSV_KIND: Record<TransactionKind, string> = {
  purchase: 'harcama',
  payment: 'ödeme',
  refund: 'iade',
  cashAdvance: 'nakit avans',
  fee: 'ücret',
};
const CSV_CARD: Record<Transaction['card'], string> = { main: 'ana', virtual: 'sanal' };

export function buildCsv(transactions: Transaction[]): string {
  const head = ['Ekstre', 'Tarih', 'Açıklama', 'Kategori', 'Kart', 'Taksit', 'Tip', 'Tutar'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = transactions.map((t) =>
    [
      t.statement,
      t.date,
      t.description,
      t.category,
      CSV_CARD[t.card],
      t.installment ?? '',
      CSV_KIND[t.kind],
      t.amount.toFixed(2).replace('.', ','),
    ]
      .map((v) => esc(String(v)))
      .join(';')
  );
  return '\uFEFF' + [head.map(esc).join(';'), ...rows].join('\r\n');
}
