import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Matchmaking + in-game status for online play. The board and move handling
// live in Home; this panel handles create/join, the lobby code, and resign.
export default function OnlinePanel({
  onlineGame,
  myColor,
  statusText,
  onlineError,
  onCreate,
  onJoin,
  onLeave,
  onResign,
}) {
  const [code, setCode] = useState('');

  if (!onlineGame) {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Play online</p>
          <Button onClick={onCreate} className="w-full">Create a new game</Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-px bg-stone-200 flex-1" />
          <span className="text-[0.65rem] uppercase tracking-widest text-stone-400">or</span>
          <div className="h-px bg-stone-200 flex-1" />
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
            <Button onClick={() => onJoin(code.trim())} disabled={code.trim().length < 4}>
              Join
            </Button>
          </div>
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
      </div>
    );
  }

  const youAre = myColor === 'w' ? 'White' : 'Black';
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400">Status</p>
          <p className="text-lg font-medium text-stone-800">{statusText}</p>
        </div>
        <span className="text-xs text-stone-400">You: {youAre}</span>
      </div>
      <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Code: {onlineGame.code}</p>
      {onlineGame.status === 'active' && (
        <Button onClick={onResign} variant="outline" className="w-full">Resign</Button>
      )}
      {onlineGame.status === 'finished' && (
        <Button onClick={onLeave} variant="outline" className="w-full">Leave</Button>
      )}
      {onlineError && <p className="text-sm text-rose-600">{onlineError}</p>}
    </div>
  );
}