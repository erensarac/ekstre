'use client';

import { useEffect, useState } from 'react';

/**
 * Kapsayicinin genisligini olcer. SVG'yi viewBox ile esnetmek yerine gercek
 * piksel genisligiyle cizdigimiz icin etiketler her ekran boyutunda ayni
 * punto kaliyor.
 */
export function useWidth<T extends HTMLElement>() {
  // Nesne ref yerine geri cagrimli ref: olculecek dugum SONRADAN da gelebilir.
  // Eskiden efekt `[]` ile bir kez kosuyordu; bir grafik ilk render'da `null`
  // donduyse (ornegin doviz grafigi tek veri noktasiyla aciliyor) `ref.current`
  // bos oluyor, efekt hemen cikiyor ve bir daha calismiyordu. Donem suzgeci
  // genisletilip grafik gercekten cizildiginde genislik 0 kaliyor, grafik
  // yedek olcusune sikisip kartin dortte birinde duruyordu.
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width] as const;
}

/**
 * Eksen icin okunakli aralik: 0 / 5.000 / 10.000 gibi yuvarlak adimlar.
 * Son adim her zaman en buyuk degere esit ya da ondan buyuk olmali — aksi halde
 * cizim tavani veriyi kesiyor ve sutunlar cerceve disina tasiyor.
 */
export function axisTicks(max: number, targetCount = 4): number[] {
  if (!isFinite(max) || max <= 0) return [0];
  const raw = max / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * magnitude).find((k) => k >= raw) ?? 10 * magnitude;
  const ceiling = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= ceiling + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

/** 12.450 -> "12,5b" — eksen ve etiketler icin kisa gosterim. */
export function compact(n: number): string {
  const m = Math.abs(n);
  if (m >= 1_000_000) return (n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + 'm';
  if (m >= 1000) return (n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: m >= 10_000 ? 0 : 1 }) + 'b';
  return Math.round(n).toLocaleString('tr-TR');
}
