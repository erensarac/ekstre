'use client';

import type { Ekstre } from '@/lib/parseEkstre';
import { monthLabel } from '@/lib/analysis';

const PRESETS = [3, 6, 12, 24, 36];

/**
 * Tek satir, tum panelin ustunde: secilen aralik asagidaki her grafigi,
 * olcumu ve tabloyu ayni anda kapsar.
 */
export default function PeriodFilter({
  statements,
  scope,
  onScope,
}: {
  statements: Ekstre[];
  scope: number | null;
  onScope: (n: number | null) => void;
}) {
  const options = PRESETS.filter((n) => n < statements.length);
  if (!options.length) return null;

  const visible = scope === null ? statements : statements.slice(-scope);
  const first = visible[0];
  const last = visible[visible.length - 1];

  return (
    <div className="filter-bar">
      <span className="filter-label">Dönem</span>
      <div className="chips" style={{ margin: 0 }}>
        <button className="chip" data-active={scope === null ? 1 : 0} onClick={() => onScope(null)}>
          Tümü
        </button>
        {options.map((n) => (
          <button key={n} className="chip" data-active={scope === n ? 1 : 0} onClick={() => onScope(n)}>
            Son {n}
          </button>
        ))}
      </div>
      <span className="filter-summary num">
        {first && last
          ? `${monthLabel(first.date)} – ${monthLabel(last.date)} · ${visible.length} ekstre`
          : '—'}
      </span>
    </div>
  );
}
