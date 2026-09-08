import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getMateBookSnapshot, getLearnedSnapshot } from '@/lib/aiLearning';

// Total endings & games Zveritas currently knows about: every solved mating
// line in the mate book plus every learned position-move memory recorded from
// played games.
function knowledgeTotal() {
  try {
    const book = getMateBookSnapshot() || {};
    const learned = getLearnedSnapshot() || {};
    let memories = 0;
    for (const key of Object.keys(learned)) {
      const entry = learned[key];
      if (entry && entry.moves) memories += Object.keys(entry.moves).length;
    }
    return Object.keys(book).length + memories;
  } catch {
    return 0;
  }
}

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
  const [knows, setKnows] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      setKnows(knowledgeTotal());
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
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ChessMaidin"
      title={`Zveritas knows ${knows.toLocaleString()} endings & games`}
      className="fixed top-2 right-3 z-10 text-[0.65rem] font-mono text-stone-400/60 hover:text-stone-600 select-none"
    >
      {count}
    </a>
  );
}