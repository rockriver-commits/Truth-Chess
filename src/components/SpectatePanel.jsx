import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MiniBoard from '@/components/MiniBoard';
import { replayStates } from '@/lib/onlineGame';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayLabel() {
  return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Always-visible "watch live games" panel. Each active game is shown as a tiny
// live board — small enough to fit several on the page — and clicking one
// opens that game as a spectator in a new tab, so watching never interrupts
// what you were doing.
export default function SpectatePanel({ activeGames, myId, onRefresh }) {
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

  // Latest position of a live game, as a tiny board diagram.
  function boardFor(g) {
    try {
      const positions = replayStates(g.moves || []);
      return positions[positions.length - 1]?.state?.board || null;
    } catch {
      return null;
    }
  }

  function openInNewTab(g) {
    window.open(`${window.location.origin}/?watch=${g.code}`, '_blank');
  }

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
        <div className="grid grid-cols-2 gap-2">
          {watchable.slice(0, 6).map((g) => {
            const board = boardFor(g);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => openInNewTab(g)}
                title={`Watch game ${g.code} in a new tab`}
                className="flex flex-col items-center gap-1 rounded-xl bg-stone-50 ring-1 ring-stone-200 hover:ring-amber-400 transition p-2"
              >
                {board ? (
                  <MiniBoard board={board} square={18} />
                ) : (
                  <div className="w-[192px] h-[174px] rounded-md bg-amber-50 ring-1 ring-stone-300" />
                )}
                <span className="font-mono text-[0.6rem] tracking-widest text-stone-600 max-w-full truncate">
                  {g.code}
                  {g.black_player_id === '__computer__' && (
                    <span className="text-amber-600"> · vs Computer</span>
                  )}
                </span>
              </button>
            );
          })}
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