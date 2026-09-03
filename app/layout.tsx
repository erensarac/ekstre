import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
// Sira onemli: yazdirma kurallari ekran kurallarini ezmeli.
import './print.css';

/**
 * Fontlar derleme aninda indirilip uygulamanin kendi icinde servis edilir.
 *
 * Onceden `<link>` ile fonts.googleapis.com'a gidiliyordu: "veri cihazindan
 * cikmaz" diyen bir uygulamada her acilista ziyaretcinin IP'si ucuncu tarafa
 * gidiyordu. Kendi icine alinca iddia kusursuz oluyor ve sayfa cevrimdisi de
 * dogru gorunuyor.
 */
const sans = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--sans-font',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--mono-font',
  display: 'swap',
});

const TITLE = 'ekstre. — Kredi kartı harcama analizi';
const DESCRIPTION =
  'Kredi kartı ekstresi PDF’lerini tarayıcıda okur; harcamaları kategorilere ayırır, ' +
  'tekrarlayan ödemeleri bulur ve toplamı bankanın kendi denklemiyle karşılaştırır. ' +
  'Dosyalar cihazdan çıkmaz — sunucu yok.';

/**
 * Paylasim gorsellerinin mutlak adrese cozulmesi icin gerekli. Tanimli
 * degilken Next.js localhost'a dusuyor ve yayinda link onizlemeleri kiriliyor.
 * Alan adi derleme aninda verilir: `NEXT_PUBLIC_SITE_URL=https://... npm run build`.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'ekstre.',
  authors: [{ name: '@erensarac', url: 'https://github.com/erensarac' }],
  keywords: ['kredi kartı ekstresi', 'harcama analizi', 'abonelik takibi', 'Enpara', 'PDF'],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'ekstre.',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ekstre. — ekstre analizi' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#faf9f5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
