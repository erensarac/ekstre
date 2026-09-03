'use client';

import { useEffect, useState } from 'react';

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * Panel uzun; yapiskan bolum gezintisi. Sadece sayfada gercekten bulunan
 * bolumler listelenir (bir bilesen veri yetersizse null donuyor olabilir).
 */
export default function SectionNav({ links }: { links: SectionLink[] }) {
  const [active, setActive] = useState<string>('');
  const [present, setPresent] = useState<SectionLink[]>([]);

  useEffect(() => {
    const existing = links.filter((l) => {
      const el = document.getElementById(l.id);
      return el && el.childElementCount > 0;
    });
    setPresent(existing);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' }
    );
    for (const l of existing) {
      const el = document.getElementById(l.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [links]);

  if (present.length < 4) return null;

  return (
    <nav className="section-nav" aria-label="Bölümler">
      {present.map((l) => (
        <a key={l.id} href={`#${l.id}`} className={active === l.id ? 'active' : undefined}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
