'use client';

import { useEffect } from 'react';

/**
 * Rota hata siniri.
 *
 * Bir bilesen cizim sirasinda patlarsa Next.js geriye bos beyaz bir sayfa
 * birakiyor: kullanici ne oldugunu da ekstrelerine ne oldugunu da bilemiyor.
 *
 * Hata hicbir yere gonderilmez. Uygulamanin sunucusu yok ve "veri cihazdan
 * cikmaz" iddiasi hata raporlama icin de gecerli — ustelik yigin izine ekstre
 * icerigi sizmis olabilir, disari gonderilmesi tam olarak kacinilan sey olurdu.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Yalnizca gelistirici konsoluna; aga cikmaz.
    console.error(error);
  }, [error]);

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            ekstre<span>.</span>
          </h1>
          <p className="tagline">Kredi kartı harcama analizi</p>
        </div>
      </header>

      <div className="error">
        <strong>Beklenmedik bir hata oluştu.</strong> Bu bir uygulama hatası; dosyalarınızda bir
        sorun olduğu anlamına gelmiyor. Ekstreler yalnızca bu sekmenin belleğinde tutulduğu için
        sayfayı yenilemek listeyi sıfırlar — hiçbiri bir yere gönderilmedi, hiçbir yere kaydedilmedi.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="primary" onClick={reset}>
          Yeniden dene
        </button>
        <button onClick={() => window.location.reload()}>Sayfayı yenile</button>
      </div>

      <p className="footnote" style={{ marginTop: 18 }}>
        Hata bir ekstreyi okurken çıktıysa o PDF beklenen şablona uymuyor olabilir; ayrıştırma
        Enpara.com şablonuna göre ayarlandı. Sorun sürerse hatayı{' '}
        <a href="https://github.com/erensarac/ekstre-analiz/issues">GitHub</a> üzerinden
        bildirebilirsiniz — bildirime PDF eklemeyin, ekstrede TCKN ve adres bilgisi var.
        {error.digest && <> Hata kodu: {error.digest}.</>}
      </p>
    </main>
  );
}
