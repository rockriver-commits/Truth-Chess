import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import TruthGuide from '@/components/TruthGuide';
import MaidenGuide from '@/components/MaidenGuide';

export default function Learn() {
  const location = useLocation();
  const maidenMode = (() => {
    try { return new URLSearchParams(location.search).get('maiden') === '1'; }
    catch { return false; }
  })();
  const back = maidenMode ? '/?maiden=1' : '/';
  const playLabel = maidenMode ? 'Play TruthMaidenChess' : 'Play Truth Chess';

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <Link to={back} className="text-sm text-amber-600 hover:underline">
          ← Back to game
        </Link>

        <div className="mt-6">
          {maidenMode ? <MaidenGuide /> : <TruthGuide />}
        </div>

        <div className="mt-10 pt-6 border-t border-stone-200">
          <Link
            to={back}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-800 text-white text-sm font-medium px-4 py-2 hover:bg-stone-900 transition"
          >
            {playLabel} →
          </Link>
        </div>
      </div>
    </div>
  );
}