import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayLabel() {
  return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Always-visible "watch live games" panel. Shown on the home page in every
// mode so anyone can spectate an active game at any time — even while playing
// a local or computer game. Lists active, non-ghost games the viewer isn't
// already part of; empty state offers a manual refresh with a spinning icon
// so it's obvious the refresh is working even when no games are live.
export default function SpectatePanel({ activeGames, myId, onWatch, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const [dailyCount, setDailyCount] = useState(null);
  const [dailyDate] = useState(todayLabel);

  // Daily games-played counter: sums every DailyStat record for today's date
  // (across all modes) and live-updates as new games are recorded.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const recs = await base44.entities.DailyStat.filter({ date: todayKey() }, 'created_date', 20);
        if (alive) setDailyCount(recs.reduce((s, r) => s + (r.count || 0), 0));
      } catch (e) {
        if (alive) setDailyCount(0);
      }
    }
    load();
    const unsub = base44.entities.DailyStat.subscribe(() => load());
    return () => { alive = false; if (unsub) unsub(); };
  }, []);
  const watchable = (activeGames || []).filter((g) => {
    if (g.black_player_id === '__ghost__') return false;
    // vs-Computer games are watchable by anyone, including the player who
    // started them (so they can spectate their own game from another device).
    if (g.black_player_id === '__computer__') return true;
    return g.white_player_id !== myId && g.black_player_id !== myId;
  });

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px bg-stone-200 flex-1" />
        <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">watch live games</span>
        <div className="h-px bg-stone-200 flex-1" />
      </div>
      {watchable.length > 0 ? (
        <div className="space-y-2">
          {watchable.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-xl bg-stone-50 ring-1 ring-stone-200 px-3 py-2"
            >
              <span className="flex items-baseline gap-2 min-w-0">
                <span className="font-mono text-sm tracking-widest text-stone-700">{g.code}</span>
                {g.black_player_id === '__computer__' && (
                  <span className="text-[0.65rem] uppercase tracking-wide text-amber-600 shrink-0">vs Computer</span>
                )}
              </span>
              <Button size="sm" variant="outline" onClick={() => onWatch(g)}>
                Watch
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-stone-50 ring-1 ring-stone-200 px-3 py-2">
          <span className="text-sm text-stone-400">
            {refreshing ? 'Checking for live games…' : 'No live games right now.'}
          </span>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between">
        <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">Games played today</span>
        <span className="text-sm font-semibold text-stone-700">
          {dailyCount == null ? '…' : dailyCount.toLocaleString()}
          <span className="ml-1.5 text-[0.7rem] font-normal text-stone-400">{dailyDate}</span>
        </span>
      </div>
    </div>
  );
}