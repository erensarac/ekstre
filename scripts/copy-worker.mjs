import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const src = join(pdfjsRoot, 'build', 'pdf.worker.min.mjs');
const destDir = join(process.cwd(), 'public');
const dest = join(destDir, 'pdf.worker.min.mjs');

if (!existsSync(src)) {
  console.error('pdf.worker.min.mjs bulunamadi. Once `npm install` calistirin.');
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('pdf worker public/ klasorune kopyalandi.');
