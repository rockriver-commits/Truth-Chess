import React from 'react';

function fmtClock(sec) {
  if (sec === null || sec === undefined) return '';
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  if (s < 10) return `${m}:${rem.toFixed(1).padStart(4, '0')}`;
  return `${m}:${String(Math.floor(rem)).padStart(2, '0')}`;
}

// Two per-side countdown pills shown above the board. The top player (per the
// current orientation) is rendered first so the layout mirrors the board.
export default function ClockBar({ whiteClock, blackClock, active, flipped }) {
  const top = flipped ? 'w' : 'b';
  const renderPill = (color) => {
    const val = color === 'w' ? whiteClock : blackClock;
    const isActive = active === color;
    const low = val !== null && val !== undefined && val < 20;
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ring-1 transition ${
          isActive
            ? 'bg-stone-800 text-white ring-stone-800'
            : 'bg-white/70 text-stone-600 ring-stone-200'
        } ${low && isActive ? 'text-rose-300' : ''}`}
      >
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            color === 'w' ? 'bg-stone-100 ring-1 ring-stone-400' : 'bg-stone-800'
          }`}
        />
        <span className="font-mono text-sm tabular-nums">{fmtClock(val)}</span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[620px] mx-auto flex items-center justify-between mb-2">
      {renderPill(top)}
      <span className="text-[0.6rem] uppercase tracking-widest text-stone-400">Clocks</span>
      {renderPill(top === 'w' ? 'b' : 'w')}
    </div>
  );
}