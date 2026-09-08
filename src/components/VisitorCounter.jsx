import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Obscure daily-visitor counter: a tiny unlabeled number pinned to the far
// top-right corner of every page. Fixed-positioned so it never affects where
// any other element sits. Counts up once per distinct visitor each day — the
// backend deduplicates per IP — and disappears entirely if the count can't be
// fetched.
export default function VisitorCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let cancelled = false;
    base44.functions
      .invoke('record-site-visit', { date })
      .then((res) => {
        if (!cancelled) setCount(res?.data?.count ?? null);
      })
      .catch(() => {
        // counter stays hidden on failure — it is decorative, never blocking
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null || !Number.isFinite(count)) return null;
  return (
    <span
      className="fixed top-2 right-3 z-10 text-[0.65rem] font-mono text-stone-400/60 select-none pointer-events-none"
      aria-hidden="true"
    >
      {count}
    </span>
  );
}