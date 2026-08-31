import React from 'react';
import { Button } from '@/components/ui/button';

// Online lobby: who's online now (registered names or "Anonymous" guests)
// plus any open games waiting for an opponent.
export default function LobbyPanel({ online, openGames, myIdentityId, onJoinGame }) {
  const others = (online || []).filter((p) => p.identity_id !== myIdentityId);
  const nameFor = (id) => {
    const p = (online || []).find((x) => x.identity_id === id);
    return p?.player_name || 'Anonymous';
  };

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-stone-400">Lobby</p>
        <span className="text-[0.7rem] text-stone-400">{others.length} online</span>
      </div>

      <div>
        <p className="text-[0.7rem] uppercase tracking-widest text-stone-400 mb-2">Players online now</p>
        {others.length === 0 ? (
          <p className="text-sm text-stone-400">No other players online. Hit Play Online to start a game.</p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-auto pr-1">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-stone-700 truncate">{p.player_name || 'Anonymous'}</span>
                {p.is_guest && (
                  <span className="text-[0.65rem] text-stone-400 shrink-0">guest</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[0.7rem] uppercase tracking-widest text-stone-400 mb-2">Open games</p>
        {(!openGames || openGames.length === 0) ? (
          <p className="text-sm text-stone-400">No open games right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {openGames.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-stone-700 truncate">
                  {nameFor(g.white_player_id)}{' '}
                  <span className="font-mono text-stone-400 text-xs">· {g.code}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onJoinGame(g)} className="shrink-0 h-7 px-2 text-xs">
                  Join
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}