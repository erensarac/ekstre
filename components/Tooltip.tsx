'use client';

export interface TooltipData {
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string }>;
  /** Isaretin ustunde yer yoksa altina acilir — kartin disina tasmasin diye */
  below?: boolean;
}

/**
 * Isaret uzerine gelindiginde acilan okuma katmani. Ipucu hicbir degeri
 * tek basina tasimaz — ayni rakamlar eksende, dogrudan etiketlerde veya
 * tablo gorunumunde de var.
 */
export default function Tooltip({ data }: { data: TooltipData | null }) {
  if (!data) return null;
  return (
    <div
      className={`tooltip${data.below ? ' below' : ''}`}
      style={{ left: data.x, top: data.y }}
      role="tooltip"
      aria-hidden
    >
      <p className="tooltip-title">{data.title}</p>
      {data.rows.map((row) => (
        <p className="tooltip-row" key={row.label}>
          <span className="tooltip-value num">{row.value}</span>
          <span className="tooltip-label">{row.label}</span>
        </p>
      ))}
    </div>
  );
}
