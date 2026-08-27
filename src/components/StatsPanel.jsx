import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Aggregates the signed-in user's finished games into a compact W/L/D record.
export default function StatsPanel({ userId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    (async () => {
      try {
        const [white, black] = await Promise.all([
          base44.entities.Game.filter({ white_player_id: userId, status: 'finished' }),
          base44.entities.Game.filter({ black_player_id: userId, status: 'finished' }),
        ]);
        const games = [...(white || []), ...(black || [])];
        let wins = 0;
        let losses = 0;
        let draws = 0;
        for (const g of games) {
          if (g.result === 'draw') draws++;
          else if (
            (g.result === 'white_wins' && g.white_player_id === userId) ||
            (g.result === 'black_wins' && g.black_player_id === userId)
          )
            wins++;
          else losses++;
        }
        if (active) setStats({ wins, losses, draws, total: games.length });
      } catch {
        if (active) setStats(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (!stats) return null;
  const rate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-stone-400">Your record</p>
        <span className="text-xs text-stone-400">{stats.total} games</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-100 py-2">
          <p className="text-xl font-semibold text-emerald-700">{stats.wins}</p>
          <p className="text-[0.65rem] uppercase tracking-wider text-emerald-600/80">Wins</p>
        </div>
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-100 py-2">
          <p className="text-xl font-semibold text-rose-700">{stats.losses}</p>
          <p className="text-[0.65rem] uppercase tracking-wider text-rose-600/80">Losses</p>
        </div>
        <div className="rounded-xl bg-stone-50 ring-1 ring-stone-200 py-2">
          <p className="text-xl font-semibold text-stone-700">{stats.draws}</p>
          <p className="text-[0.65rem] uppercase tracking-wider text-stone-500">Draws</p>
        </div>
      </div>
      <p className="text-center text-xs text-stone-400 mt-2">Win rate {rate}%</p>
    </div>
  );
}