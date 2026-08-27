import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, RefreshCw } from 'lucide-react';

// Ranks Truth Chess players by total wins. Wins are aggregated server-side
// by the getLeaderboard backend function (across all finished games, with
// player names resolved there), so every logged-in user sees the same board.
export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setError('');
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getLeaderboard', {});
      setRows(res.data?.leaderboard || []);
    } catch (e) {
      setError('Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const list = rows || [];

  const rankStyles = [
    'bg-amber-100 text-amber-700',
    'bg-stone-200 text-stone-700',
    'bg-orange-100 text-orange-700',
  ];

  return (
    <section className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-600" />
        <h2 className="text-base font-semibold text-stone-800">Leaderboard</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : rows === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-stone-400">
          No finished games yet. Win a game to claim the top spot!
        </p>
      ) : (
        <ol className="space-y-1.5">
          {list.slice(0, 10).map((r, i) => (
            <li
              key={r.user_id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-stone-50"
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                  i < 3 ? rankStyles[i] : 'text-stone-400'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm text-stone-700">{r.name}</span>
              <span className="text-xs text-stone-400 hidden sm:inline">{r.games} games</span>
              <span className="font-semibold text-stone-800">{r.wins}</span>
              <span className="text-[0.65rem] uppercase tracking-wider text-stone-400">wins</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}