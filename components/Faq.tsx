import type { ReactNode } from 'react';

/**
 * Bos ekranda, birakma alaninin altinda duran soru-cevap.
 *
 * Yerli `<details>` kullaniliyor: klavyeyle acilir, JavaScript gerektirmez,
 * arama motoru ve ekran okuyucu icin de dogru isaretlemedir.
 */

interface Soru {
  q: string;
  a: ReactNode;
}

const SORULAR: Soru[] = [
  {
    q: 'Ekstrem nereye gidiyor?',
    a: (
      <>
        Hiçbir yere. Dosya tarayıcının belleğinde açılıp orada işleniyor; ne bir sunucuya
        yükleniyor, ne diske kaydediliyor, ne de bir analiz servisine gönderiliyor. Bu uygulamanın{' '}
        <strong>sunucusu yok</strong> — arkasında yalnızca statik dosyalar var, dosya kabul edecek
        bir uç nokta bulunmuyor.
      </>
    ),
  },
  {
    q: 'Buna nasıl güvenebilirim?',
    a: (
      <>
        Söze güvenmeniz gerekmiyor, üç şekilde kendiniz doğrulayabilirsiniz:
        <ul>
          <li>
            Tarayıcının geliştirici araçlarını açıp <em>Ağ</em> sekmesini izleyin — PDF’i
            bıraktığınızda giden bir istek görmeyeceksiniz.
          </li>
          <li>
            Sayfa açıldıktan sonra internet bağlantınızı kesin. Uygulama çalışmaya devam eder;
            yazı tipleri bile kendi içinden geliyor, dışarıya tek istek gitmiyor.
          </li>
          <li>Kaynak kodu açık; ayrıştırma ve analiz katmanının tamamı okunabilir durumda.</li>
        </ul>
      </>
    ),
  },
  {
    q: 'PDF nasıl okunuyor?',
    a: (
      <>
        PDF’te tablo diye bir yapı yoktur; dosya “şu yazı şu koordinata” listesinden ibarettir.
        Uygulama her metin parçasının konumunu alıp aynı yükseklikte olanları tek satır sayıyor,
        soldan sağa diziyor ve görsel tabloyu geri kuruyor. Solda tarih, sağda tutar biçiminde olan
        satırlar işlem kabul ediliyor; başlıklar ve sayfa numaraları bu iki koşul sayesinde
        kendiliğinden eleniyor.
      </>
    ),
  },
  {
    q: 'Rakamların doğru olduğunu nereden bileceğim?',
    a: (
      <>
        Ekstrenin kendi özet kutusunda zaten bir denklem var:{' '}
        <em>önceki borç − ödemeler + harcamalar + nakit avans + faiz = ekstre borcu</em>. Uygulama
        okuduğu işlemlerin toplamını bu rakamlarla karşılaştırıyor ve sonucu Mutabakat bölümünde
        dönem dönem gösteriyor: <strong>✓</strong> tutuyor, <strong>!</strong> fark var,{' '}
        <strong>?</strong> özet kutusu okunamadı. Son işaret “doğru” demek değil,{' '}
        <em>kontrol edilemedi</em> demek — doğrulanmamış bir dönemi onaylıymış gibi göstermiyor.
      </>
    ),
  },
  {
    q: 'Hangi bankalar destekleniyor?',
    a: (
      <>
        Şimdilik yalnızca <strong>Enpara.com</strong> kredi kartı ekstreleri. Ayrıştırma, o
        şablondaki sütun konumlarına göre ayarlandı. Başka bir bankanın PDF’ini yüklerseniz
        uygulama bunu anlayıp açık bir hata veriyor — sessizce yanlış rakam üretmiyor.
      </>
    ),
  },
  {
    q: 'Kaç ekstre yükleyebilirim?',
    a: (
      <>
        Bir sınır yok; hepsini birlikte seçebilirsiniz ve tek tabloda birleşirler. Beş yıllık bir
        set (60 ekstre, yaklaşık 1.500 işlem) rahatça çalışıyor. Aynı ekstreyi iki kez yüklerseniz
        tekrar sayılmaz; farklı kartların aynı tarihli ekstreleri ise ayrı ayrı korunur.
      </>
    ),
  },
  {
    q: 'Taranmış ya da fotoğrafı çekilmiş ekstre olur mu?',
    a: (
      <>
        Olmaz. Bu yöntem PDF’in içindeki metin katmanını okuyor; taranmış bir belgede o katman
        bulunmaz, yalnızca görüntü vardır. Bankanızın uygulamasından indirdiğiniz orijinal PDF
        gerekiyor.
      </>
    ),
  },
  {
    q: 'Veriler saklanıyor mu, sonra geri gelir mi?',
    a: (
      <>
        Saklanmıyor. Sekmeyi kapattığınızda ya da sayfayı yenilediğinizde her şey gider — çerez
        yok, tarayıcı deposu yok, hesap yok. Sonuçları saklamak isterseniz işlem listesinin altından{' '}
        <strong>CSV</strong> olarak indirebilirsiniz.
      </>
    ),
  },
  {
    q: 'Ekstrem yok, yine de görebilir miyim?',
    a: (
      <>
        <strong>Örnek veriyle dene</strong> düğmesi beş yıllık uydurma bir kart geçmişi yüklüyor —
        gerçek bir kişiye ait değil. Bütün bölümler o veriyle dolar ve mutabakat tikleri orada da
        gerçekten hesaplanır.
      </>
    ),
  },
  {
    q: 'Ücretli mi?',
    a: (
      <>
        Hayır. Sunucu olmadığı için işletme maliyeti de yok; kayıt, abonelik ya da ödeme adımı
        bulunmuyor.
      </>
    ),
  },
];

export default function Faq() {
  return (
    <section className="section faq">
      <h2>Sıkça sorulan sorular</h2>
      <div className="card faq-list">
        {SORULAR.map((s, i) => (
          // Ilki acik: bolumun acilir oldugu anlasilsin ve en cok sorulan soru
          // tiklamadan cevaplansin.
          <details className="faq-item" key={s.q} open={i === 0}>
            <summary className="faq-q">{s.q}</summary>
            <div className="faq-a">{s.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
