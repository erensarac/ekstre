import { itemsToRows, parseEkstreRows, type Ekstre } from '../lib/parseEkstre';

/* ---------------- kucuk test kosucusu ---------------- */

let passed = 0;
let failed = 0;
let currentSection = '';

export function section(name: string) {
  currentSection = name;
  console.log(`\n── ${name}`);
}

export function expect(name: string, ok: boolean, detail: unknown = '') {
  if (ok) passed++;
  else failed++;
  const extra = detail === '' || detail === undefined ? '' : `  →  ${String(detail)}`;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra}`);
  if (!ok) console.log(`      (${currentSection})`);
}

export function equals(name: string, actual: unknown, expected: unknown) {
  expect(name, Object.is(actual, expected), `${String(actual)} (beklenen ${String(expected)})`);
}

export function close(name: string, actual: number, expected: number, tolerance = 0.01) {
  expect(name, Math.abs(actual - expected) <= tolerance, `${actual} (beklenen ~${expected})`);
}

export function summary(): number {
  console.log(`\n${failed === 0 ? 'TÜMÜ GEÇTİ' : `${failed} KONTROL BAŞARISIZ`}  ·  ${passed} geçti`);
  return failed === 0 ? 0 : 1;
}

/* ---------------- sentetik ekstre kurucusu ----------------
 * Elle Ekstre nesnesi uydurmak yerine ayristiricinin bekledigi koordinatlarda
 * metin parcalari uretilir; boylece testler gercek ayristirma yolunu kullanir.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');
const tl = (n: number) =>
  (n < 0 ? '- ' : '') +
  Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  ' TL';
const p = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

export interface FixtureTransaction {
  day: number;
  description: string;
  amount: number;
  installment?: string;
}

export interface Fixture {
  month?: string;
  year?: number;
  cardNo?: string;
  /** verilmezse ozet kutusu hic yazilmaz — "unverifiable" durumu icin */
  summary?: [number, number, number, number, number, number];
  transactions: FixtureTransaction[];
}

export function buildStatement(f: Fixture): Ekstre {
  const month = f.month ?? '03';
  const year = f.year ?? 2025;
  const items = [
    p('Ekstre tarihi', 40, 780),
    p(`28/${month}/${year}`, 200, 780),
    p('Son ödeme tarihi', 40, 766),
    p(`08/${pad2(Number(month) + 1)}/${year}`, 200, 766),
    p('Kart numarası', 320, 766),
    p(f.cardNo ?? '5400 **** **** 4417', 440, 766),
    p('Kart limiti', 320, 752),
    p(tl(60000), 440, 752),
  ];
  if (f.summary) items.push(...f.summary.map((n, j) => p(tl(n), 60 + j * 82, 706)));

  let y = 676;
  for (const i of f.transactions) {
    items.push(p(`${pad2(i.day)}/${month}/${year}`, 50, y), p(i.description, 200, y));
    if (i.installment) items.push(p(i.installment, 420, y));
    items.push(p(tl(i.amount), 455, y));
    y -= 13;
  }

  return parseEkstreRows([itemsToRows(items)], `test-${month}.pdf`);
}
