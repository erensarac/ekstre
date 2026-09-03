import type { Metadata } from 'next';

/**
 * `public/afis.png` bu sayfadan uretilir — README'nin en ustundeki gorsel.
 *
 * `og-gorsel` ile ayni gerekce: gorselin kaynagi repoda dursun ki marka ya da
 * renk degisince yeniden uretilebilsin. Sayfa uygulamanin kendi fontlarini ve
 * renk degiskenlerini kullanir, yani afis arayuzle her zaman ayni gorunur.
 *
 * Yeniden uretmek icin (gelistirme rozeti gorsele islenmesin diye URETIM
 * sunucusundan alinir):
 *
 *   npm run build && npm run start
 *   chrome --headless=new --window-size=1280,320 \
 *     --screenshot=public/afis.png http://localhost:3000/afis
 */

export const metadata: Metadata = {
  title: 'afiş — ekstre.',
  robots: { index: false, follow: false },
};

export default function Banner() {
  return (
    <div
      style={{
        width: 1280,
        height: 320,
        background: 'var(--kagit)',
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        fontFamily: 'var(--sans)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 104,
          fontWeight: 600,
          letterSpacing: '-0.045em',
          lineHeight: 1,
          color: 'var(--murekkep)',
        }}
      >
        ekstre<span style={{ color: 'var(--vurgu)' }}>.</span>
      </p>
    </div>
  );
}
