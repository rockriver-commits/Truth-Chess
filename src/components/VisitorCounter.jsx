import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Obscure daily-visitor counter: a tiny unlabeled number pinned to the far
// top-right corner of every page. Fixed-positioned so it never affects where
// any other element sits. Counts up once per distinct visitor each day — the
// backend deduplicates per IP — and quietly re-fetches every 5 seconds so
// new visitors show up almost immediately. Clicking the number opens
// ChessMaidin. It disappears entirely if the count can't be fetched.
const MAIDIN_URL = 'https://play-truthmaidin-chess.base44.app/';
const REFRESH_MS = 5000;

export default function VisitorCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      base44.functions
        .invoke('record-site-visit', { date })
        .then((res) => {
          if (!cancelled) setCount(res?.data?.count ?? null);
        })
        .catch(() => {
          // keep the last count on a failed refresh — never blocking
        });
    };
    ping();
    const id = setInterval(ping, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (count == null || !Number.isFinite(count)) return null;
  return (
    <a
      href={MAIDIN_URL}
      aria-label="ChessMaidin"
      title="ChessMaidin"
      className="fixed top-2 right-3 z-10 text-[0.65rem] font-mono text-stone-400/60 hover:text-stone-600 select-none"
    >
      {count}
    </a>
  );
}