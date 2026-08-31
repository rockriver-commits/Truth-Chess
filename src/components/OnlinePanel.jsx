import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatPanel from '@/components/ChatPanel';

// Online lobby, streamlined around a single "Play Online" action that finds an
// open game or starts a new one. Private host/join-by-code is kept as an
// optional expandable section for players who want to invite a specific
// friend — but it's no longer the default path.
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
  onLeave,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
}) {
  const [code, setCode] = useState('');
  const [showPrivate, setShowPrivate] = useState(false);

  // ---- No game yet: matchmaking lobby ------------------------------------
  if (!onlineGame) {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-stone-400">Play online</p>
          {!myId ? (
            <div className="space-y-2">
              <p className="text-sm text-stone-500">Create a free account to play online.</p>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/register"><Button className="w-full">Register</Button></Link>
                <Link to="/login"><Button variant="outline" className="w-full">Sign in</Button></Link>
              </div>
            </div>
          ) : (
            <>
              <Button onClick={onQuickMatch} className="w-full h-11 text-base">
                Play Online
              </Button>
              <p className="text-[0.7rem] text-stone-400 text-center">
                We'll match you with an available opponent, or start a new game
                if none are waiting.
              </p>
            </>
          )}
        </div>

        {/* Optional private-game path, collapsed by default */}
        <div className="border-t border-stone-100 pt-4">
          <button
            type="button"
            onClick={() => setShowPrivate((s) => !s)}
            className="w-full text-left text-[0.7rem] uppercase tracking-widest text-stone-400 hover:text-stone-600 transition"
          >
            {showPrivate ? '▾' : '▸'} Play a private game with a code
          </button>
          {showPrivate && (
            <div className="mt-3 space-y-3">
              <Button onClick={onCreate} variant="outline" className="w-full">
                Create a private game
              </Button>
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
          )}
        </div>

        {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
      </div>
    );
  }

  // ---- Waiting room (player created a game, no opponent yet) --------------
  if (onlineGame.status === 'waiting') {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 text-center space-y-3">
        <div className="w-8 h-8 mx-auto border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
        <p className="text-sm font-medium text-stone-700">Finding an opponent…</p>
        <p className="text-[0.7rem] text-stone-400">
          Or share this code for a friend: <span className="font-mono tracking-widest text-stone-600">{onlineGame.code}</span>
        </p>
        <Button onClick={onLeave} variant="outline" className="w-full">Cancel</Button>
        {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
      </div>
    );
  }

  // ---- Active / finished game -------------------------------------------
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
        {onlineGame.status === 'active' && !spectator && (
          onlineGame.draw_offer_by && onlineGame.draw_offer_by !== myColor ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={onAcceptDraw}>Accept Draw</Button>
              <Button size="sm" variant="outline" onClick={onDeclineDraw}>Decline</Button>
            </div>
          ) : onlineGame.draw_offer_by === myColor ? (
            <p className="text-xs text-stone-500 text-center py-1">Draw offered — waiting for response…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onResign} variant="outline">Resign</Button>
              <Button onClick={onOfferDraw} variant="outline">Offer Draw</Button>
            </div>
          )
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