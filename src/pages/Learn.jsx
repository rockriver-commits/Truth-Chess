import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import TruthGuide from '@/components/TruthGuide';
import { loadAdSense } from '@/lib/adsense';

export default function Learn() {
  // Ads load only on this content page and are removed on unmount.
  useEffect(() => loadAdSense(), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <Link to="/" className="text-sm text-amber-600 hover:underline">
          ← Back to game
        </Link>

        <div className="mt-6">
          <TruthGuide />
        </div>

        <div className="mt-10 pt-6 border-t border-stone-200">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-stone-800 text-white text-sm font-medium px-4 py-2 hover:bg-stone-900 transition"
          >
            Play Truth Chess →
          </Link>
        </div>
      </div>
    </div>
  );
}