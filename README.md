<p align="center">
  <img src="public/afis.png" alt="ekstre." width="880">
</p>

<p align="center">
  <b>Kredi kartı harcama analizi</b><br>
  Ekstre PDF’lerini tarayıcıda ayrıştıran Next.js uygulaması.<br>
  Sunucu yok, veritabanı yok, dosya yükleme yok.
</p>

---

## Ne yapar

PDF’i açtığın anda kategoriler, abonelikler ve grafikler çıkar. Ama asıl iş **bulgular**
bölümünde: ekstrede yazan ham alanlardan çıkarım üretir ve para kaybettiren maddeyi başa alır.

Örnek verinin bir çalıştırmasında çıkan bulgulardan bazıları — veri her yüklemede yeniden
üretildiği için rakamlar değişir, çıkarımların türü değişmez:

> **7.520,41 ₺ nakit avans çekilmiş** — Ağu 25 döneminde. Nakit avansta faizsiz gün yoktur, faiz
> ilk günden işler. O dönemdeki ücret ve faiz toplamı 815 ₺.
>
> **3.660,46 ₺ faiz ve vergi ödendi** — 3 dönemde tahakkuk etti. Bu tutarın karşılığında hiçbir şey alınmadı.
>
> **Nis 25, Ara 25 döneminde asgari tutar ödenmiş** — Kalan borç bir sonraki ekstreye faiziyle devrediyor.
>
> **LODOS LOKANTA — 675,97 ₺ aynı gün 2 kez çekilmiş** — Mükerrer çekim olabilir; dekontla karşılaştırmaya değer.
>
> **VODAFONE FATURA ODEME 429,00 ₺ → 519,00 ₺** — Ara 25 döneminde zamlandı, yıllık etkisi 1.080 ₺.
>
> **TODTV DIJITAL YAYIN artık çekilmiyor — son ödeme Mar 26** — İptal ettiysen sorun yok; etmediysen yeniden başlayabilir.
>
> **Büyük harcamaları ayın 1’ine çekersen 7 gün daha uzun faizsiz kullanırsın** — 2.500 ₺ üzeri
> harcamalarda ortalama 30 gün faizsiz süre kullanılmış; genel ortalama 25 gün.
>
> **Önümüzdeki dönemler için 44.586,72 ₺ taksit taahhüdün var** — Bu tutar henüz hiçbir ekstrede
> görünmüyor; son taksit Mar 27’de bitiyor.

Bunların hiçbiri tahmin değil; hepsi tarih, tutar, taksit ve özet kutusu alanlarından hesaplanıyor.

## Doğrulama — projenin güvendiği tek şey

Ekstrenin kendi özet kutusunda zaten bir denklem var:

```
önceki borç − ödemeler + harcamalar + nakit avans + faiz = ekstre borcu
```

Uygulama, ayrıştırdığı işlemlerin toplamını bu rakamlarla karşılaştırır. **Sonuç üç durumludur:**

| İşaret | Anlamı |
|:---:|---|
| **✓** | Okunan işlemlerin toplamı ekstredeki rakamla birebir tutuyor — hiçbir satır atlanmamış |
| **!** | Fark var — o dönemin rakamlarına güvenme |
| **?** | Özet kutusu okunamadı, **karşılaştırılacak bir şey yok** |

`?` ile `✓` arasındaki fark bu aracın bütün iddiası. Doğrulanamayan bir dönemi onay tiki gibi
göstermek, sessizce yanlış rakam sunmak olurdu. Bir ekstre bile doğrulanamıyorsa bu, bulgular
listesinin **en başında** uyarı olarak çıkar — çünkü aşağıdaki her rakam o ekstrelerden türüyor.

## Neden sunucu yok

PDF’ler `pdfjs-dist` ile tamamen tarayıcıda ayrıştırılır. API route yok, veritabanı yok, dosya
yükleme yok. `next build` çıktısı tamamen statik — Vercel, Netlify, GitHub Pages ya da kendi
nginx’inde çalışır, sunucu maliyeti sıfır.

Bu sadece maliyet meselesi değil: ekstrede TCKN, açık adres, kart numarası ve tüm harcama geçmişi
var. Veri hiç ağa çıkmazsa saklama, şifreleme, KVKK aydınlatma metni ve sızıntı riski gibi
sorunların tamamı ortadan kalkar.

İddianın kusursuz olması için fontlar da dışarıdan çekilmiyor: `next/font` ile derleme anında
indirilip uygulamanın kendi içinden servis ediliyorlar. Sayfa yüklendikten sonra hiçbir üçüncü
tarafa istek gitmez. Bir bileşen patlarsa devreye giren hata sınırı da (`app/error.tsx`) hatayı
hiçbir yere göndermez — yığın izine ekstre içeriği sızmış olabilir.

Bunu söze bırakmamak için ana sayfada, dosya bırakma alanının altında bir **sıkça sorulan sorular**
bölümü var: verinin nereye gittiği, ağ sekmesinden nasıl doğrulanacağı, interneti kapatıp
denenebileceği ve rakamların neye göre doğrulandığı orada yazılı.

## Ayrıştırma nasıl çalışıyor

PDF’te tablo diye bir şey yoktur — “şu yazı şu koordinata” listesi vardır. pdf.js her metin
parçasını `transform` matrisiyle verir; `itemsToRows` bunları **y koordinatına göre** gruplar
(±1.5pt tolerans) ve her grubu x’e göre soldan sağa dizer. Görsel tablo satırları böyle geri kurulur.

Bir satır şu koşulları sağlıyorsa işlemdir: solda (x ≤ 80) `GG/AA/YYYY` tarihi, sağda (x ≥ 440)
`1.234,56 TL` biçiminde tutar. Aradaki hücreler açıklamayı oluşturur; x > 400 konumundaki `3/3`
kalıbı taksit bilgisidir. Başlıklar, sayfa numaraları ve özet kutusu bu iki koşul sayesinde
kendiliğinden elenir.

```
lib/parseEkstre.ts   PDF metin katmanı → yapısal veri (saf, I/O yok)
lib/pdf.ts           pdfjs yükleyici; dosya → Ekstre (sadece tarayıcı)
lib/analysis.ts      toplamlar, çıkarımlar, abonelik tespiti, CSV (saf)
lib/sample.ts        örnek veri üreteci — tohumlu, gerçek ayrıştırıcıdan geçer
components/          sunum katmanı
app/page.tsx         tüm durum burada; use client
```

`lib/parseEkstre.ts` ve `lib/analysis.ts` DOM’a, `window`’a, `fetch`’e dokunmaz — Node’da doğrudan
çalıştırılabilirler, testler bu yüzden mümkün.

## Analizler

| Bölüm | Ne gösterir |
|---|---|
| **Bulgular** | Otomatik çıkarımlar, para kaybettiren madde başta |
| **Mutabakat** | Dönem dönem doğrulama (✓ / ! / ?) |
| **Kategori × dönem** | Isı haritası — hangi kalem hangi ay kabarmış |
| **İşyerleri** | Şube/şehir ekleri ayıklanarak birleştirilmiş sıralama |
| **Harcama profili** | İşlem büyüklüğü dağılımı ve haftanın günü |
| **Faizsiz gün** | Ayın gününe göre bedava kredi süresi |
| **Yurt dışı** | Döviz harcamaları ve efektif kur seyri |
| **Taksit takvimi** | Henüz hiçbir ekstrede görünmeyen ileriye dönük borç |
| **Limit ve kullanım** | Limit artışları ve borç/limit oranı tek grafikte |
| **Ödeme ve kullanım** | Ödeme disiplini karnesi, sanal kart payı, iadeler, nakit avans |
| **Tekrarlayan ödemeler** | Abonelikler + hangi dönem çekildiğini gösteren takvim şeridi |
| **Alışkanlıklar** | Tutarı değişen ama sıklığı sabit harcamalar |

Üstteki dönem süzgeci **her şeyi** kapsar: ölçümler, bulgular, grafikler, tablo ve CSV çıktısı.

### Abonelik tespiti

Bir işyeri şu üç testi birden geçerse abonelik sayılır:

1. En az **3 ayrı takvim ayında** görünür.
2. Tutar tekrar eder — ardışık çekimlerin en az %60’ı birbirinin %4’ü içindedir. Bu test market
   alışverişi gibi düzenli ama tutarı oynak harcamaları eler.
3. Ayın **hep aynı günü** civarında döner (±2 gün). Bu test dağınık mağaza alışverişlerini eler.

Üçüncü testin yan ürünü: ayın farklı günlerinde ayrı ayrı dönen kümeler sayılırsa **paralel
abonelik** sayısı çıkar — aynı serviste aynı anda çalışan birden fazla abonelik böyle görünür.

Taksitli işlemler bu testten muaftır: taksit üçünü de geçer ama abonelik değildir, sonlu ve bitiş
tarihi bellidir. Onu taksit takvimi gösterir.

## Rapor çıktısı

**Rapor al** düğmesi analizin tamamını yazdırılabilir bir belgeye çevirir: kapak sayfası, kapsanan
dönem aralığı, ekstre ve kart sayısı, ve ilk sayfada **mutabakat durumu** — kaç dönem ✓, kaç
dönem ! veya ?. Doğrulanamayan dönemler raporda da açıkça yazılır; belge elden ele dolaşabildiği
için “hepsi tamam” izlenimi verilmez.

Bunun için ayrı bir PDF kütüphanesi kullanılmıyor. `window.print()` + `app/print.css` ile
tarayıcının kendi yazdırma motoru çalışıyor; çıktı **vektörel ve metin katmanlı** oluyor, yani
rapordaki tutarlar seçilebilir ve aranabilir. jsPDF/html2canvas yolu grafikleri piksele çevirip
bunu kaybettirirdi. Grafiklerin kâğıt genişliğine orantılı küçülmesi için SVG’lere `viewBox`
eklidir; ekran görüntüsü değişmez.

İşlem listesi raporda ekranda görünen kadarıyla yer alır ve kaç işlem gösterildiği belgenin
sonunda yazar — tamamı için CSV çıktısı vardır.

## Kurulum

Node 18.18+.

```bash
npm install
npm run dev
```

`predev` / `prebuild` adımı pdf.js worker dosyasını `public/` içine kopyalar; bu adım atlanırsa
ayrıştırma sessizce çalışmaz.

Ekstren yoksa **Örnek veriyle dene** düğmesi temsilî bir kart geçmişi yükler: 18–24 ekstre
(en fazla 2 yıl), ~700–950 işlem. Her yüklemede yeniden üretilir, yani iki kez aynı ekranı
görmezsin. Doğrudan bağlantı vermek için: `/?ornek=1`

Paylaşım görsellerinin mutlak adrese çözülmesi için alan adını derleme anında verin; verilmezse
`localhost` varsayılır ve link önizlemeleri kırık gelir:

```bash
NEXT_PUBLIC_SITE_URL=https://ornek.com npm run build
```

## Test

```bash
npm test
```

66 kontrol; mutabakat değişmezi, doğrulamanın üç durumu, aynı tarihli ekstrenin kaybolmaması,
pencere boyutundan bağımsız abonelik regresyonu (3 / 6 / 12 / 24 / tüm dönem), taksit
projeksiyonu, faizsiz gün, döviz, iade, nakit avans, ödeme disiplini ve kategori kapsamı.

Örnek veri rastgele üretildiği için tek bir setin doğru olması bir şey kanıtlamaz: testler
**120 farklı tohumda** mutabakat denkleminin tuttuğunu ayrıca doğrular. Tek bir tohumda bile
kırılırsa arayüz bazı kullanıcılara sessizce yanlış rakam gösteriyor demektir.

Testler sentetik ekstreleri **gerçek ayrıştırıcıya** verir — elle `Ekstre` nesnesi uydurmaz, yani
`parseEkstreRows` yolunu atlamazlar. `lib/` saf olduğu için tip soyma bayrağı gerekmez, Node 18’de
de çalışır.

## Başka bankalar

`lib/parseEkstre.ts` içindeki x/y eşikleri ve `labelValue` çağrıları Enpara şablonuna göre
ayarlanmıştır. Başka bankaya uyarlarken:

1. Bankanın PDF’inde satırların x aralıklarını **bir kez ölçün** — tahmin etmeyin.
2. `RE_DATE`, `RE_AMOUNT` ve eşik değerlerini güncelleyin.
3. Özet kutusundaki alan sırasını `parseEkstreRows` içinde eşleyin.

Doğrulama mekanizması sayesinde uyarlamanın doğru olup olmadığını hemen görürsünüz: tutmuyorsa
`!`, karşılaştırılamıyorsa `?` çıkar.

`CATEGORY_RULES` dizisi kategori eşleştirmesini tutar ve **sıralıdır** — ilk eşleşen kazanır. Yeni işyeri
eklerken sıraya dikkat edin: `Market` kuralı `Yeme-içme`den önce gelir, yoksa “Trendyol - Market”
yemek sayılır.

## Bilinçli sınırlar

- **Tek banka.** Enpara şablonuna kalibre edilmiştir.
- **Tek kartın penceresi.** Nakit, havale, diğer hesaplar görünmez. Birden fazla kartın ekstresi
  yüklenirse toplamlar birleştirilir, mutabakat kart bazında ayrı kalır.
- **Hafıza yok.** Sayfa yenilenince her şey gider — hiçbir şey saklanmadığı için.
- **Bazı çıkarımlar geçmiş ister.** Zam tespiti ve duran abonelik 3–4 dönemden azıyla güvenilir
  değildir.
- **Koyu tema yok.**

## Görseller

`public/og.png` ve `public/afis.png` sırasıyla `/og-gorsel` ve `/afis` rotalarından üretilir.
Kaynakları repoda durur ki marka veya renk değişince yeniden üretilebilsinler; her iki rota da
arama motorlarına kapalıdır. Üretme komutu dosyaların başında yazılıdır.
