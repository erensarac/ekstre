export type TransactionKind = 'purchase' | 'payment' | 'refund' | 'cashAdvance' | 'fee';

export interface ForeignAmount {
  amount: number;
  currency: string;
}

export interface Transaction {
  id: string;
  statement: string;
  date: string;
  description: string;
  amount: number;
  installment: string | null;
  card: 'main' | 'virtual';
  kind: TransactionKind;
  category: string;
  /** description icinde "(12,34 USD)" gibi bir ek varsa yabanci para bilgisi */
  foreign: ForeignAmount | null;
}

export interface StatementSummary {
  previousBalance: number | null;
  payments: number | null;
  purchases: number | null;
  cashAdvance: number | null;
  interestAndTax: number | null;
  statementBalance: number | null;
}

/**
 * Bir kontrolun sonucu.
 *
 * `unverifiable`, `matched` ile ayni sey DEGILDIR: ozet kutusundaki rakam
 * okunamadiysa karsilastirilacak bir sey yok demektir. Bunlari tek bir boolean
 * altinda toplamak, hicbir sey dogrulanmadigi halde arayuzde onay tiki
 * gostermeye yol aciyordu.
 */
export type VerificationState = 'matched' | 'mismatch' | 'unverifiable';

export interface Verification {
  purchases: VerificationState;
  payments: VerificationState;
  balance: VerificationState;
  /** ucunun bilesimi: bir tanesi bile tutmuyorsa 'mismatch' */
  result: VerificationState;
  computedPurchases: number;
  computedPayments: number;
}

export interface Ekstre {
  /** ayni gun kesilen farkli kartlarin ekstreleri birbirini ezmesin diye */
  id: string;
  date: string;
  dueDate: string | null;
  minPayment: number | null;
  cardLimit: number | null;
  availableLimit: number | null;
  cardNo: string | null;
  summary: StatementSummary;
  verification: Verification;
  transactions: Transaction[];
}

export interface Cell {
  x: number;
  s: string;
}
export interface Row {
  y: number;
  cells: Cell[];
}

const RE_DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_AMOUNT = /^-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*TL$/;
const RE_INSTALLMENT = /^\d{1,2}\/\d{1,2}$/;
/** Yurt disi harcamalarda description metnine eklenen yabanci para tutari. */
const RE_FOREIGN = /\(\s*([\d.]*\d,\d{2})\s*(USD|EUR|GBP|CHF|JPY)\s*\)/i;

export function parseAmount(s: string): number | null {
  if (!s) return null;
  const neg = /^-/.test(s.trim());
  const n = parseFloat(s.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.'));
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function toIsoDate(s: string): string {
  const [d, m, y] = s.split('/');
  return `${y}-${m}-${d}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * pdf.js parcalari mutlak koordinatla gelir, satir bilgisi vermez: ayni y
 * koordinatindakiler (+-1.5pt tolerans) tek satir sayilir, x'e gore soldan
 * saga dizilir.
 */
export function itemsToRows(items: Array<{ str: string; transform: number[] }>): Row[] {
  const buckets = new Map<number, Cell[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    let key = y;
    for (const k of buckets.keys()) {
      if (Math.abs(k - y) <= 1.5) {
        key = k;
        break;
      }
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ x: it.transform[4], s: it.str.trim() });
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, cells]) => ({ y, cells: cells.sort((a, b) => a.x - b.x) }));
}

function labelValue(rows: Row[], label: string, maxLabelX = Infinity): string | null {
  for (const r of rows) {
    for (let i = 0; i < r.cells.length; i++) {
      if (r.cells[i].s === label && r.cells[i].x <= maxLabelX) {
        const v = r.cells[i + 1];
        if (v) return v.s;
      }
    }
  }
  return null;
}

const CATEGORY_RULES: Array<[string, RegExp]> = [
  ['Yazılım & AI', /WINDSURF|COGNITION|ANTHROPIC|CURSOR|GITHUB|OPENAI|VERCEL|FIGMA|NOTION|YAZILIM/i],
  ['Dijital abonelik', /NETFLIX|SPOTIFY|AMAZONPRIME|AMAZON PRIME|TODTV|YOUTUBE|DISNEY|BLUTV|EXXEN|APPLE\.COM|GOOGLE ?\*/i],
  ['Market', /TRENDYOL - MARKET|MIGROS|A101|BIM|ŞOK|CARREFOUR|FİLE MARKET|KENT GROSS|GETIR|MARKET|BAKKAL|ÇETİNLER/i],
  [
    'Yeme-içme',
    /TRENDYOL - YEMEK|YEMEKSEPETI|GETIRYEMEK|BURGER|KOFTECI|KÖFTE|DÖNE|DONER|CAFE|KAFE|KAHVE|COFFEE|PASTAN|MANTI|ÇORBA|ETLİEKMEK|KIOSK|KİOSK|UNLU MAM|FIRIN|LOKANTA|RESTORAN|PROFITEROL|GIDA|KEBAP|PIZZA|STARBUCKS/i,
  ],
  [
    'Elektronik & teknoloji',
    /VATAN BILGISAYAR|MEDIAMARKT|MEDIA MARKT|TEKNOSA|APPLE STORE|ARZUM|PHILIPS|ARCELIK|ARÇELIK|BEKO|VESTEL|SAMSUNG|HEPSIBURADA|AMAZON\.COM\.TR|N11|ALIEXPRESS/i,
  ],
  ['Ev & mobilya', /IKEA|BELLONA|ISTIKBAL|İSTIKBAL|MUDO|ENZA HOME|KOCTAS|KOÇTAŞ|BAUHAUS|TEPE HOME/i],
  ['Seyahat & konaklama', /BOOKING|AIRBNB|HOTEL|OTEL|ETSTUR|JOLLY|TATIL|EXPEDIA|TRIVAGO/i],
  ['Evcil hayvan', /PETSHOP|PET SHOP|PATI|VETERINER|MAMA DUNYASI/i],
  ['Akaryakıt', /PETROL|SHELL|OPET|\bBP\b|TOTAL|AKARYAK|BENZIN/i],
  ['Ulaşım', /TOPLU TAŞI|ESTRAM|TRAMVAY|METRO|IETT|OTOBUS|TAKSI|UBER|BITAKSI|THY|PEGASUS/i],
  ['Sağlık', /ECZANE|ECZANESI|HASTANE|MEDICAL|POLIKLINIK|LABORATUVAR|DENTAL/i],
  ['Giyim & spor', /MAVI JEANS|DECATHLON|LC WAIKIKI|KOTON|DEFACTO|ZARA|H&M|BOYNER|NIKE|ADIDAS|FLO\b/i],
  ['Fatura & telekom', /TURKCELL|VODAFONE|TURK TELEKOM|PAYCELL|ESGAZ|ZORLU ENERJI|ELEKTRIK|DOGALGAZ|FINDEKS|F\?NDEKS|AIDAT/i],
  ['Eğlence & hobi', /EPIC GAMES|STEAM|PLAYSTATION|XBOX|OYUNCAK|SINEMA|CINEMA|BILETIX|ERTAŞ CD|KITAP|D&R/i],
  ['Nakit avans & ücretler', /NAKIT AVANS|KKDF|BSMV|GECIKME/i],
];

export function categorize(description: string): string {
  for (const [name, re] of CATEGORY_RULES) if (re.test(description)) return name;
  return 'Diğer';
}

/**
 * Bir ekstrenin tum sayfalarindan gelen satirlari yapisal veriye cevirir.
 * Hicbir sey diske veya aga yazilmaz — saf fonksiyon.
 */
export function parseEkstreRows(pagesRows: Row[][], fileName = ''): Ekstre {
  const allRows = pagesRows.flat();
  const p1 = pagesRows[0] || [];

  const rawDate = labelValue(p1, 'Ekstre tarihi', 200);
  if (!rawDate || !RE_DATE.test(rawDate)) {
    throw new Error(
      `${fileName || 'Dosya'}: "Ekstre tarihi" alanı bulunamadı. Bu bir Enpara kredi kartı ekstresi PDF'i olmayabilir.`
    );
  }
  const date = toIsoDate(rawDate);

  const summaryRow = p1.find(
    (r) => r.cells.length >= 5 && r.cells.length <= 7 && r.cells.every((c) => RE_AMOUNT.test(c.s))
  );
  const summaryCells = summaryRow ? summaryRow.cells.map((c) => parseAmount(c.s)) : [];

  const summary: StatementSummary = {
    previousBalance: summaryCells[0] ?? null,
    payments: summaryCells[1] ?? null,
    purchases: summaryCells[2] ?? null,
    cashAdvance: summaryCells[3] ?? null,
    interestAndTax: summaryCells[4] ?? null,
    statementBalance: summaryCells[5] ?? parseAmount(labelValue(p1, 'Ekstre borcu', 200) || ''),
  };

  const transactions: Transaction[] = [];
  let virtual = false;
  let seq = 0;

  for (const r of allRows) {
    const flat = r.cells.map((c) => c.s).join(' ');
    if (/numaralı sanal kredi kartınızla/i.test(flat)) {
      virtual = true;
      continue;
    }
    if (/^Sayfa \d+ \/ \d+$/.test(flat.trim())) {
      virtual = false;
      continue;
    }

    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (!first || !last || r.cells.length < 2) continue;
    if (!RE_DATE.test(first.s) || first.x > 80) continue;
    if (!RE_AMOUNT.test(last.s) || last.x < 440) continue;

    let installment: string | null = null;
    const parts: string[] = [];
    for (const c of r.cells.slice(1, -1)) {
      if (RE_INSTALLMENT.test(c.s) && c.x > 400) {
        installment = c.s;
        continue;
      }
      parts.push(c.s);
    }

    const description = parts.join(' ').replace(/\s+/g, ' ').trim();
    const amount = parseAmount(last.s);
    if (amount === null) continue;

    let kind: TransactionKind = 'purchase';
    if (/^Ödeme\s*-/i.test(description)) kind = 'payment';
    else if (/\(iade\)/i.test(description)) kind = 'refund';
    else if (/Karttan nakit avans/i.test(description)) kind = 'cashAdvance';
    else if (/Nakit avans (faizi|ücreti)|KKDF|BSMV/i.test(description)) kind = 'fee';

    const foreignMatch = RE_FOREIGN.exec(description);
    const foreignAmount = foreignMatch ? parseAmount(foreignMatch[1]) : null;

    transactions.push({
      id: `${date}-${seq++}`,
      statement: date,
      date: toIsoDate(first.s),
      description,
      amount,
      installment,
      card: virtual ? 'virtual' : 'main',
      kind,
      category: kind === 'payment' ? 'Ödeme' : categorize(description),
      foreign:
        foreignMatch && foreignAmount !== null && foreignAmount > 0
          ? { amount: foreignAmount, currency: foreignMatch[2].toUpperCase() }
          : null,
    });
  }

  const totalPurchases = round2(
    transactions.filter((t) => t.kind === 'purchase').reduce((s, t) => s + t.amount, 0)
  );
  const totalPayments = round2(
    transactions
      .filter((t) => t.kind === 'payment' || t.kind === 'refund')
      .reduce((s, t) => s - t.amount, 0)
  );

  const { previousBalance, payments, purchases, cashAdvance, interestAndTax, statementBalance } =
    summary;
  const chainTotal =
    previousBalance !== null && payments !== null && purchases !== null
      ? round2(previousBalance - payments + purchases + (cashAdvance ?? 0) + (interestAndTax ?? 0))
      : null;

  /** Karsilastirilacak rakam yoksa "unverifiable" — "matched" degil. */
  const compare = (computed: number, declared: number | null): VerificationState =>
    declared === null ? 'unverifiable' : Math.abs(computed - declared) < 0.02 ? 'matched' : 'mismatch';

  const purchaseState = compare(totalPurchases, purchases);
  const paymentState = compare(totalPayments, payments);
  const balanceState: VerificationState =
    chainTotal === null || statementBalance === null
      ? 'unverifiable'
      : Math.abs(chainTotal - statementBalance) < 0.02
        ? 'matched'
        : 'mismatch';

  const states = [purchaseState, paymentState, balanceState];
  const verification: Verification = {
    purchases: purchaseState,
    payments: paymentState,
    balance: balanceState,
    // Tutmayan bir kontrol, dogrulanamayan bir kontrolden daha agirdir:
    // ilki bilinen bir celiskidir, ikincisi bilgi yoklugudur.
    result: states.includes('mismatch')
      ? 'mismatch'
      : states.includes('unverifiable')
        ? 'unverifiable'
        : 'matched',
    computedPurchases: totalPurchases,
    computedPayments: totalPayments,
  };

  const cardNo = labelValue(p1, 'Kart numarası', 400);

  return {
    // Ayni gun kesilen iki farkli kartin ekstresi ayni anahtara dusmesin.
    id: `${date}|${cardNo ?? ''}`,
    date,
    dueDate: (labelValue(p1, 'Son ödeme tarihi', 200) || '').trim() || null,
    minPayment: parseAmount(labelValue(p1, 'Minimum ödeme tutarı', 200) || ''),
    cardLimit: parseAmount(labelValue(p1, 'Kart limiti', 400) || ''),
    availableLimit: parseAmount(labelValue(p1, 'Kullanılabilir kart limiti', 400) || ''),
    cardNo,
    summary,
    verification,
    transactions,
  };
}
