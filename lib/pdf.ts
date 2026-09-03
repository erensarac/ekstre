import { itemsToRows, parseEkstreRows, type Ekstre, type Row } from './parseEkstre';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return mod;
    });
  }
  return pdfjsPromise;
}

/**
 * Tek bir PDF dosyasini okur. Dosya sadece tarayicinin belleginde islenir;
 * hicbir yere yuklenmez, hicbir yere kaydedilmez.
 */
export async function readStatement(file: File): Promise<Ekstre> {
  const pdfjs = await getPdfJs();
  const buf = new Uint8Array(await file.arrayBuffer());

  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true }).promise;
  try {
    const pages: Row[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      pages.push(
        itemsToRows(
          tc.items
            .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it)
            .map((it) => ({ str: it.str, transform: it.transform }))
        )
      );
      page.cleanup();
    }
    return parseEkstreRows(pages, file.name);
  } finally {
    await doc.destroy();
  }
}

export interface ReadResult {
  statements: Ekstre[];
  errors: Array<{ file: string; message: string }>;
}

export async function readStatements(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<ReadResult> {
  const statements: Ekstre[] = [];
  const errors: Array<{ file: string; message: string }> = [];

  for (let i = 0; i < files.length; i++) {
    try {
      statements.push(await readStatement(files[i]));
    } catch (e) {
      errors.push({ file: files[i].name, message: e instanceof Error ? e.message : String(e) });
    }
    onProgress?.(i + 1, files.length);
  }

  // Ayni dosya iki kez yuklendiyse tekini tut. Anahtar tarih DEGIL, `id`:
  // tarih + kart numarasi. Yalnizca tarihe bakildiginda ayni gun kesilen iki
  // farkli kartin ekstresinden biri sessizce siliniyordu.
  const unique = new Map<string, Ekstre>();
  for (const e of statements) unique.set(e.id, e);

  return {
    statements: [...unique.values()].sort((a, b) => a.id.localeCompare(b.id)),
    errors,
  };
}
