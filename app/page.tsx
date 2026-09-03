'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ekstre } from '@/lib/parseEkstre';
import { readStatements } from '@/lib/pdf';
import {
  allTransactions,
  buildCsv,
  cardSplit,
  cashAdvanceAnalysis,
  categoryTotals,
  detectSubscriptions,
  findings,
  foreignSpending,
  gracePeriod,
  habits,
  heatMap,
  installmentSchedule,
  installmentSummary,
  limitChanges,
  limitUsage,
  lastPeriods,
  merchantChurn,
  overview,
  paymentDiscipline,
  refundAnalysis,
  statementTotals,
} from '@/lib/analysis';

import DropZone from '@/components/DropZone';
import Faq from '@/components/Faq';
import ReportCover from '@/components/ReportCover';
import PeriodFilter from '@/components/PeriodFilter';
import SectionNav, { type SectionLink } from '@/components/SectionNav';
import Findings from '@/components/Findings';
import Reconciliation from '@/components/Reconciliation';
import Metrics from '@/components/Metrics';
import PeriodChart from '@/components/PeriodChart';
import HeatMap from '@/components/HeatMap';
import Categories from '@/components/Categories';
import Merchants from '@/components/Merchants';
import SpendingProfile from '@/components/SpendingProfile';
import GracePeriod from '@/components/GracePeriod';
import ForeignSpending from '@/components/ForeignSpending';
import InstallmentSchedule from '@/components/InstallmentSchedule';
import LimitUsage from '@/components/LimitUsage';
import PaymentAndUsage from '@/components/PaymentAndUsage';
import Subscriptions from '@/components/Subscriptions';
import Habits from '@/components/Habits';
import TransactionList from '@/components/TransactionList';

const SECTIONS: SectionLink[] = [
  { id: 'bulgular', label: 'Bulgular' },
  { id: 'mutabakat', label: 'Mutabakat' },
  { id: 'aylik', label: 'Dönemler' },
  { id: 'isi', label: 'Kategori × dönem' },
  { id: 'kategoriler', label: 'Kategoriler' },
  { id: 'isyerleri', label: 'İşyerleri' },
  { id: 'profil', label: 'Profil' },
  { id: 'faizsiz', label: 'Faizsiz gün' },
  { id: 'doviz', label: 'Yurt dışı' },
  { id: 'taksit', label: 'Taksit' },
  { id: 'limit', label: 'Limit' },
  { id: 'odeme', label: 'Ödeme' },
  { id: 'abonelik', label: 'Abonelikler' },
  { id: 'aliskanlik', label: 'Alışkanlıklar' },
  { id: 'islemler', label: 'İşlemler' },
];

/** Cok donemli setlerde varsayilan gorunum son bir yil. */
const DEFAULT_PERIOD_SCOPE = 12;

/**
 * Yukleme sonrasi ne olduğunu yazar.
 *
 * "Ekstre ekle" dugmesi eklemeli mi calisiyor yoksa listeyi sifirliyor mu —
 * etiketten anlasilmiyordu. Sonucu rakamla soylemek, dugmeyi yeniden
 * adlandirmaktan daha net: kullanici tahmin etmek zorunda kalmiyor.
 */
function addSummary(fresh: number, duplicate: number, replaced: boolean): string {
  const parts = [replaced ? 'Örnek veri kaldırıldı.' : null];
  parts.push(fresh === 0 ? 'Yeni ekstre eklenmedi.' : `${fresh} ekstre eklendi.`);
  if (duplicate > 0) parts.push(`${duplicate} tanesi listede zaten vardı.`);
  return parts.filter(Boolean).join(' ');
}

/** "Ocak 2024 – Aralık 2025" — kac donem oldugunu metne gomup eskitmemek icin. */
function periodSpan(statements: Ekstre[]): string | null {
  if (!statements.length) return null;
  const format = (iso: string) =>
    new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1).toLocaleDateString('tr-TR', {
      month: 'long',
      year: 'numeric',
    });
  const first = format(statements[0].date);
  const last = format(statements[statements.length - 1].date);
  return first === last ? first : `${first} – ${last}`;
}

export default function Page() {
  const [statements, setStatements] = useState<Ekstre[]>([]);
  const [errors, setErrors] = useState<Array<{ file: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [scope, setScope] = useState<number | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [addNote, setAddNote] = useState<string | null>(null);

  // Suzgec asagidaki her seyi kapsar: bulgular, olcumler, grafikler, tablo, CSV.
  const visible = useMemo(() => lastPeriods(statements, scope), [statements, scope]);

  const transactions = useMemo(() => allTransactions(visible), [visible]);
  const summary = useMemo(() => overview(visible), [visible]);
  const categories = useMemo(() => categoryTotals(transactions), [transactions]);
  const periodTotals = useMemo(() => statementTotals(visible), [visible]);
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const heat = useMemo(() => heatMap(transactions), [transactions]);
  const limits = useMemo(() => limitUsage(visible), [visible]);
  const limitDeltas = useMemo(() => limitChanges(visible), [visible]);
  const installments = useMemo(() => installmentSummary(transactions), [transactions]);
  const installmentPlan = useMemo(() => installmentSchedule(transactions), [transactions]);
  const findingList = useMemo(() => findings(visible, subscriptions), [visible, subscriptions]);
  const grace = useMemo(() => gracePeriod(visible), [visible]);
  const foreign = useMemo(() => foreignSpending(transactions), [transactions]);
  const discipline = useMemo(() => paymentDiscipline(visible), [visible]);
  const cards = useMemo(() => cardSplit(transactions), [transactions]);
  const refunds = useMemo(() => refundAnalysis(transactions), [transactions]);
  const cashAdvance = useMemo(() => cashAdvanceAnalysis(visible), [visible]);
  const habitList = useMemo(() => habits(transactions, subscriptions), [transactions, subscriptions]);
  const churn = useMemo(() => merchantChurn(transactions), [transactions]);

  function add(incoming: Ekstre[], replace = false) {
    setStatements((previous) => {
      const base = replace ? [] : previous;
      // Anahtar `id` (tarih + kart no) — bkz. lib/pdf.ts: yalnizca tarihe
      // bakmak, ayni gun kesilen ikinci kartin ekstresini siliyordu.
      const byId = new Map(base.map((e) => [e.id, e]));
      for (const e of incoming) byId.set(e.id, e);
      const all = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
      // Ilk yuklemede cok donem varsa son bir yila odaklan; kullanici
      // "Tumu"ye gecebilir. Sonraki eklemelerde secimi bozma.
      if (base.length === 0) setScope(all.length > DEFAULT_PERIOD_SCOPE ? DEFAULT_PERIOD_SCOPE : null);
      return all;
    });
  }

  async function addFiles(files: File[]) {
    setLoading(true);
    setProgress({ done: 0, total: files.length });
    try {
      const result = await readStatements(files, (done, total) => setProgress({ done, total }));
      // Ornek veri gercek ekstrelerle BIRLESMEZ, yerini birakir. Kurgusal
      // rakamlarin gercek toplamlara sizmasi, dogru rakam uretme iddiasindaki
      // bir araci sessizce yalanci yapar.
      const replacing = isSample;
      const known = new Set(replacing ? [] : statements.map((e) => e.id));
      const fresh = result.statements.filter((e) => !known.has(e.id)).length;
      setIsSample(false);
      add(result.statements, replacing);
      setErrors(result.errors);
      setAddNote(addSummary(fresh, result.statements.length - fresh, replacing));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  /** Ornek veri yalnizca istendiginde indirilir; ilk yuklemeyi buyutmez. */
  async function loadSample() {
    setLoading(true);
    try {
      const { sampleStatements } = await import('@/lib/sample');
      setErrors([]);
      setAddNote(null);
      setIsSample(true);
      add(sampleStatements(), true);
    } finally {
      setLoading(false);
    }
  }

  // "?ornek=1" ile dogrudan dolu panele baglanti verilebilir.
  const sampleRequested = useRef(false);
  useEffect(() => {
    if (sampleRequested.current) return;
    if (new URLSearchParams(window.location.search).has('ornek')) {
      sampleRequested.current = true;
      void loadSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAll() {
    setStatements([]);
    setErrors([]);
    setScope(null);
    setIsSample(false);
    setAddNote(null);
  }

  function exportCsv() {
    const csv = buildCsv(transactions);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ekstre-islemleri.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasData = statements.length > 0;
  const span = periodSpan(statements);
  // Birden fazla kart varsa analizler kartlari birlestirir; bunu soylemek gerekir.
  const cardNumbers = [...new Set(statements.map((e) => e.cardNo).filter(Boolean))] as string[];

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            ekstre<span>.</span>
          </h1>
          <p className="tagline">Kredi kartı harcama analizi</p>
        </div>
        {hasData && (
          // Dar ekranda uc dugme tek satira sigmiyor ve sayfayi yatay
          // kaydiriyordu; sarmasi gerekiyor.
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Etiket duruma gore degisir: ornek veri uzerindeyken tiklamak
                ekleme degil degistirme demek, dugme de bunu soylemeli. */}
            <button
              onClick={() => document.getElementById('ekle')?.click()}
              title={
                isSample
                  ? 'Örnek veri kaldırılır, yerine seçtiğiniz ekstreler gelir'
                  : 'Seçtiğiniz ekstreler şu anki listeye eklenir'
              }
            >
              {isSample ? 'Kendi ekstrelerini yükle' : 'Ekstre ekle'}
            </button>
            {/* Tarayicinin yazdirma penceresini acar; kullanici oradan
                "PDF olarak kaydet" secer. Sunucu gerektirmeyen, metni
                secilebilir birakan tek yol. */}
            <button onClick={() => window.print()} title="Yazdır ya da PDF olarak kaydet">
              Rapor al
            </button>
            <button onClick={clearAll} title="Yüklü ekstrelerin tamamını kaldırır">
              Temizle
            </button>
            <input
              id="ekle"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length) addFiles(f);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </header>

      {errors.length > 0 && (
        <div className="error">
          {errors.map((h) => (
            <div key={h.file}>{h.message}</div>
          ))}
        </div>
      )}

      {addNote && (
        <div className="notice" role="status">
          {addNote}
        </div>
      )}

      {isSample && (
        <div className="notice">
          <strong>Örnek veri.</strong> Gördüğünüz {statements.length} ekstre temsilî bir karta ait
          {span ? ` (${span})` : ''} — kurgudur, gerçek bir kişinin harcamaları değildir. Kendi
          ekstrelerinizi görmek için &quot;Kendi ekstrelerini yükle&quot;yi kullanın; örnek veri
          kaldırılır, rakamlar birbirine karışmaz.
        </div>
      )}

      {cardNumbers.length > 1 && (
        <div className="notice">
          <strong>{cardNumbers.length} farklı kart.</strong> {cardNumbers.join(', ')} — aşağıdaki
          toplamlar ve grafikler bu kartların hepsini birlikte gösterir. Mutabakat satırları kart
          bazında ayrıdır.
        </div>
      )}

      {!hasData && (
        <>
          <DropZone onFiles={addFiles} onSample={loadSample} loading={loading} progress={progress} />
          <Faq />
        </>
      )}

      {hasData && (
        <>
          {/* Yalnizca baskida gorunur; ekranda `app/print.css` gizler.
              Suzgecten gecmis set veriliyor, cunku rapor da onu gosteriyor. */}
          <ReportCover statements={visible} span={periodSpan(visible)} />
          <PeriodFilter statements={statements} scope={scope} onScope={setScope} />
          <SectionNav links={SECTIONS} />
          <Metrics
            overview={summary}
            periods={periodTotals}
            subscriptions={subscriptions}
            installments={installments}
          />
          <div id="bulgular">
            <Findings data={findingList} />
          </div>
          <div id="mutabakat">
            <Reconciliation statements={visible} />
          </div>
          <div id="aylik">
            <PeriodChart data={periodTotals} />
          </div>
          <div id="isi">
            <HeatMap data={heat} />
          </div>
          <div id="kategoriler">
            <Categories data={categories} />
          </div>
          <div id="isyerleri">
            <Merchants transactions={transactions} />
          </div>
          <div id="profil">
            <SpendingProfile transactions={transactions} />
          </div>
          <div id="faizsiz">
            <GracePeriod data={grace} />
          </div>
          <div id="doviz">
            <ForeignSpending data={foreign} />
          </div>
          <div id="taksit">
            <InstallmentSchedule data={installmentPlan} />
          </div>
          <div id="limit">
            <LimitUsage data={limits} changes={limitDeltas} />
          </div>
          <div id="odeme">
            <PaymentAndUsage
              discipline={discipline}
              cards={cards}
              refunds={refunds}
              cashAdvance={cashAdvance}
            />
          </div>
          <div id="abonelik">
            <Subscriptions data={subscriptions} transactions={transactions} />
          </div>
          <div id="aliskanlik">
            <Habits data={habitList} churn={churn} />
          </div>
          <div id="islemler">
            <TransactionList transactions={transactions} onExport={exportCsv} />
          </div>
        </>
      )}
    </main>
  );
}
