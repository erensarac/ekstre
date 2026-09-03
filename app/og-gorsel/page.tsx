import type { Metadata } from 'next';

/**
 * `public/og.png` bu sayfadan uretilir.
 *
 * Paylasim gorseli bir kez cizilip unutulan bir dosya olmasin diye kaynagi
 * repoda duruyor: slogan, marka ya da renk degisince gorsel yeniden
 * uretilebilir olmali.
 *
 * Yeniden uretmek icin (gelistirme rozeti gorsele islenmesin diye URETIM
 * sunucusundan alinir):
 *
 *   npm run build && npm run start
 *   chrome --headless=new --window-size=1200,630 \
 *     --screenshot=public/og.png http://localhost:3000/og-gorsel
 *
 * Sayfa uygulamanin kendi fontlarini ve renk degiskenlerini kullanir; boylece
 * gorsel arayuzle her zaman ayni gorunur.
 */

export const metadata: Metadata = {
  title: 'og görseli — ekstre.',
  robots: { index: false, follow: false },
};

export default function OgImage() {
  const rows = [
    ['Eki 25', '32.467 − 32.467 + 32.406', '32.406'],
    ['Kas 25', '32.406 − 33.276 + 35.363', '34.493'],
    ['Ara 25', '34.493 − 34.493 + 59.880', '59.880'],
  ];

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: 'var(--kagit)',
        padding: '76px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        fontFamily: 'var(--sans)',
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 78,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'var(--murekkep)',
          }}
        >
          ekstre<span style={{ color: 'var(--vurgu)' }}>.</span>
        </p>
        <p
          style={{
            margin: '18px 0 0',
            fontSize: 30,
            color: 'var(--murekkep)',
            letterSpacing: '-0.01em',
          }}
        >
          Kredi kartı harcama analizi
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 21, color: 'var(--gri)', maxWidth: '52ch' }}>
          Ekstre PDF’lerini okur; harcamayı kategorilere ayırır, abonelikleri bulur ve toplamı
          bankanın kendi denklemiyle karşılaştırır.
        </p>
      </div>

      <div
        style={{
          background: 'var(--kart)',
          border: '1px solid var(--cizgi)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {rows.map(([month, equation, result], i) => (
          <div
            key={month}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 30px',
              alignItems: 'center',
              gap: 20,
              padding: '15px 24px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--cizgi)' : 'none',
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 19, color: 'var(--gri)' }}>
              {month}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 19 }}>
              {equation} = <b style={{ color: 'var(--vurgu)', fontWeight: 600 }}>{result}</b>
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--onay-zemin)',
                color: 'var(--onay)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              ✓
            </span>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 20, color: 'var(--gri)' }}>
        <b style={{ color: 'var(--onay)' }}>Sunucu yok.</b> Dosyalar cihazdan çıkmaz, hiçbir yere
        yüklenmez.
      </p>
    </div>
  );
}
