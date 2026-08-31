import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

// Always-visible "watch live games" panel. Shown on the home page in every
// mode so anyone can spectate an active game at any time — even while playing
// a local or computer game. Lists active, non-ghost games the viewer isn't
// already part of; empty state offers a manual refresh with a spinning icon
// so it's obvious the refresh is working even when no games are live.
export default function SpectatePanel({ activeGames, myId, onWatch, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
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
    </div>
  );
}