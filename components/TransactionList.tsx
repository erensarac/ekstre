'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/parseEkstre';
import { tl, dayMonth, isSpending, categoryTotals, merchantTotals } from '@/lib/analysis';
import type { Transaction as Txn } from '@/lib/parseEkstre';

const STEP = 40;

/** "DENIZYILDIZI MARKET" -> "Denizyildizi Market". */
const titleCase = (s: string) =>
  s
    // Turkce yerel ayarda 'I' -> 'ı' olur; ekstre metni ASCII buyuk harf
    // yazildigi icin bu yanlis sonuc veriyor ("DENIZ" -> "denız").
    .toLocaleLowerCase('en')
    .split(' ')
    .map((w) => (w ? w[0].toLocaleUpperCase('en') + w.slice(1) : w))
    .join(' ');

/**
 * Arama kutusundaki ornekleri yuklu veriden turetir.
 *
 * Sabit yazilmis isimler ("Windsurf, Trendyol, Mavi Jeans") kullanicinin
 * ekstresinde hic gecmeyebiliyor; onerilen kelimeyi aratmak bos sonuc
 * veriyordu. Siklik sirasi secilir: sik gecen isyeri hem taninir hem de
 * aratildiginda dolu bir liste dondurur.
 */
function searchHint(transactions: Txn[]): string {
  const picked: string[] = [];
  const seenBrands = new Set<string>();

  for (const m of [...merchantTotals(transactions)].sort((a, b) => b.count - a.count)) {
    if (picked.length === 3) break;
    // Uzun adlar kutuyu tasirir; ayni markanin varyantlari tekrar gibi durur.
    if (m.merchant.length > 20) continue;
    const brand = m.merchant.split(' ')[0];
    if (seenBrands.has(brand)) continue;
    seenBrands.add(brand);
    picked.push(titleCase(m.merchant));
  }

  return picked.length ? `${picked.join(', ')}…` : 'İşyeri veya açıklama ara…';
}

export default function TransactionList({
  transactions,
  onExport,
}: {
  transactions: Transaction[];
  onExport: () => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(STEP);

  const categories = useMemo(() => categoryTotals(transactions), [transactions]);
  const hint = useMemo(() => searchHint(transactions), [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase('tr').trim();
    return transactions
      .filter(isSpending)
      .filter((t) => (!category || t.category === category))
      .filter((t) => !q || t.description.toLocaleLowerCase('tr').includes(q))
      .slice()
      .reverse();
  }, [transactions, search, category]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const selectCategory = (c: string) => {
    setCategory(c);
    setLimit(STEP);
  };

  return (
    <section className="section">
      <h2>İşlemler</h2>

      <div className="toolbar">
        <div>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(STEP);
            }}
            placeholder={hint}
            aria-label="İşlemlerde ara"
          />
        </div>
        <button onClick={onExport}>CSV indir</button>
      </div>

      <div className="chips">
        <button
          className="chip"
          data-active={category === '' ? 1 : 0}
          onClick={() => selectCategory('')}
        >
          Tümü
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            className="chip"
            data-active={category === c.category ? 1 : 0}
            onClick={() => selectCategory(c.category)}
          >
            {c.category}
          </button>
        ))}
      </div>

      <p className="footnote" style={{ margin: '0 0 10px' }}>
        {filtered.length} işlem · {tl(total)}
      </p>

      {/* `txn-list` yalnizca baski icin: bu kart bir sayfaya sigmayacak kadar
          uzun, "bolunmesin" kurali disinda tutuluyor (bkz. app/print.css). */}
      <div className="card txn-list">
        {filtered.length === 0 && <p className="empty">Eşleşen işlem yok.</p>}
        {filtered.slice(0, limit).map((t) => (
          <div className="txn" key={t.id}>
            <span className="txn-date">{dayMonth(t.date)}</span>
            <span className="txn-desc" title={t.description}>
              {t.description}
              <span className="txn-meta">
                {t.category}
                {t.card === 'virtual' && ' · sanal kart'}
                {t.installment && ` · ${t.installment} taksit`}
              </span>
            </span>
            <span className={`txn-amount${t.amount < 0 ? ' negative' : ''}`}>{tl(t.amount)}</span>
          </div>
        ))}
      </div>

      {filtered.length > limit && (
        <button style={{ width: '100%', marginTop: 12 }} onClick={() => setLimit((l) => l + STEP)}>
          Daha fazla göster ({filtered.length - limit} kaldı)
        </button>
      )}

      {/* Baskida "daha fazla goster" dugmesi gizleniyor; kesildigi soylenmezse
          rapor 490 islemin tamamini gosteriyormus gibi okunur. */}
      {filtered.length > limit && (
        <p className="footnote print-only">
          Bu raporda ilk {limit} işlem yer alıyor; listenin tamamı ({filtered.length} işlem) için
          ekrandan CSV indirin.
        </p>
      )}
    </section>
  );
}
