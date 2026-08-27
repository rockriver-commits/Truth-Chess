import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatPanel from '@/components/ChatPanel';

// Online lobby + matchmaking + in-game status + spectating + chat. The board
// and move handling live in Home; this panel handles Quick Match, the live
// open-games lobby, private host/join-by-code, spectating active games, the
// waiting room, resign/leave, and the in-game chat.
export default function OnlinePanel({
  onlineGame,
  myColor,
  myId,
  openGames,
  activeGames,
  spectator,
  statusText,
  onlineError,
  onQuickMatch,
  onCreate,
  onJoinCode,
  onJoinGame,
  onReenterOwn,
  onStartGhost,
  onWatch,
  onLeave,
  onResign,
}) {
  const [code, setCode] = useState('');

  if (!onlineGame) {
    const games = openGames || [];
    const watchable = (activeGames || []).filter(
      (g) => g.white_player_id !== myId && g.black_player_id !== myId && g.black_player_id !== '__ghost__'
    );
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-stone-400">Play online</p>
          <Button onClick={onQuickMatch} className="w-full">Quick Match</Button>
          <p className="text-[0.7rem] text-stone-400">
            Join an open game, or start a new one if none are waiting.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Open games</p>
          {games.length === 0 ? (
            <p className="text-sm text-stone-400">
              No open games right now. Tap Quick Match to start one.
            </p>
          ) : (
            <div className="space-y-2">
              {games.map((g) => {
                const mine = g.white_player_id === myId;
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-xl bg-stone-50 ring-1 ring-stone-200 px-3 py-2"
                  >
                    <span className="font-mono text-sm tracking-widest text-stone-700">
                      {g.code}
                      {mine && (
                        <span className="ml-2 text-[0.6rem] uppercase tracking-wider text-amber-600">
                          your game
                        </span>
                      )}
                    </span>
                    {mine ? (
                      <Button size="sm" variant="outline" onClick={() => onReenterOwn(g)}>
                        Open
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => onJoinGame(g)}>Join</Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px bg-stone-200 flex-1" />
          <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">or private</span>
          <div className="h-px bg-stone-200 flex-1" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Host with a code</p>
          <Button onClick={onCreate} variant="outline" className="w-full">
            Create a new game
          </Button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Join with a code</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={5}
              className="uppercase tracking-widest font-mono"
            />
            <Button onClick={() => onJoinCode(code.trim())} disabled={code.trim().length < 4}>
              Join
            </Button>
          </div>
        </div>

        {watchable.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px bg-stone-200 flex-1" />
              <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">spectate</span>
              <div className="h-px bg-stone-200 flex-1" />
            </div>
            <div className="space-y-2">
              {watchable.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl bg-stone-50 ring-1 ring-stone-200 px-3 py-2"
                >
                  <span className="font-mono text-sm tracking-widest text-stone-700">{g.code}</span>
                  <Button size="sm" variant="outline" onClick={() => onWatch(g)}>
                    Watch
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-px bg-stone-200 flex-1" />
          <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">test</span>
          <div className="h-px bg-stone-200 flex-1" />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-stone-400">Test online sync</p>
          <Button onClick={onStartGhost} variant="outline" className="w-full">
            Play vs AI (ghost)
          </Button>
          <p className="text-[0.7rem] text-stone-400">
            The AI plays the opponent over the live channel — no second account needed.
          </p>
        </div>

        {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
      </div>
    );
  }

  if (onlineGame.status === 'waiting') {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 text-center space-y-3">
        <p className="text-xs uppercase tracking-widest text-stone-400">Share this code</p>
        <p className="text-4xl font-display font-semibold tracking-[0.2em] text-stone-800">
          {onlineGame.code}
        </p>
        <p className="text-sm text-stone-500">{statusText}</p>
        <Button onClick={onLeave} variant="outline" className="w-full">Cancel</Button>
        {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
      </div>
    );
  }

  const youAre = spectator ? 'Spectator' : myColor === 'w' ? 'White' : 'Black';
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400">Status</p>
            <p className="text-lg font-medium text-stone-800">{statusText}</p>
          </div>
          <span className="text-xs text-stone-400">You: {youAre}</span>
        </div>
        <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Code: {onlineGame.code}</p>
        {!spectator && onlineGame.status === 'active' && (
          <Button onClick={onResign} variant="outline" className="w-full">Resign</Button>
        )}
        <Button onClick={onLeave} variant="outline" className="w-full">
          {spectator ? 'Stop spectating' : 'Leave'}
        </Button>
        {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
      </div>
      <ChatPanel gameCode={onlineGame.code} userId={myId} />
    </div>
  );
}