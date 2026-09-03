'use client';

import { useRef, useState } from 'react';

export default function DropZone({
  onFiles,
  onSample,
  loading,
  progress,
}: {
  onFiles: (files: File[]) => void;
  onSample: () => void;
  loading: boolean;
  progress: { done: number; total: number } | null;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter(
      (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    );
    if (pdfs.length) onFiles(pdfs);
  };

  return (
    <div
      className={`dropzone${over ? ' dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
    >
      <h3>Ekstre PDF’lerinizi buraya bırakın</h3>
      <p>
        Enpara.com kredi kartı ekstresi PDF’leri. Birden fazla ayı aynı anda seçebilirsiniz — hepsi
        tek tabloda birleşir.
      </p>

      <div className="dropzone-actions">
        <button
          className="primary"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          aria-label="Dosya seç"
        >
          {loading
            ? progress
              ? `Okunuyor… ${progress.done}/${progress.total}`
              : 'Okunuyor…'
            : 'Dosya seç'}
        </button>
        <button onClick={onSample} disabled={loading}>
          Örnek veriyle dene
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />

      <p className="dropzone-note">
        Ekstreniz yoksa örnek veriyle gezinebilirsiniz — temsilî bir karta ait, kurgudur.
      </p>

      <div>
        <span className="privacy-badge">
          <b>Dosyalar cihazınızdan çıkmaz.</b> Sunucuya yüklenmez, kaydedilmez.
        </span>
      </div>
    </div>
  );
}
