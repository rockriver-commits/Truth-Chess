import React from 'react';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward, CircleDot } from 'lucide-react';

// Post-game step-through controls. `index` is null when viewing the live
// (final) position; otherwise it is a 0-based index into the snapshot list.
// Prev / Next step one move at a time; First / Last jump to the ends; Live
// returns to the final position. At the live (final) state, Prev and First
// are enabled so you can immediately start reviewing the game.
export default function ReplayBar({ index, total, onFirst, onPrev, onNext, onLast, onLive, disabled }) {
  const atLive = index === null;
  const atFirst = index === 0;
  const atLast = atLive || index === total - 1;
  const label = atLive ? `Live ${total}/${total}` : `${index + 1}/${total}`;
  const off = !!disabled;

  const base =
    'flex items-center justify-center rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed select-none';
  const grey = 'bg-stone-200 text-stone-700 hover:bg-stone-300';
  const orange = 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm';

  return (
    <div className="w-full max-w-[600px] mx-auto mt-3 rounded-2xl bg-stone-100 ring-1 ring-stone-200 p-2.5 shadow-sm">
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={onFirst} disabled={atFirst || off} title="First move"
          className={`${base} ${grey} h-9 w-9`}>
          <SkipBack className="h-4 w-4" />
        </button>
        <button type="button" onClick={onPrev} disabled={atFirst || off} title="Previous move"
          className={`${base} ${orange} h-9 px-4 gap-1`}>
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">Prev</span>
        </button>
        <span className="min-w-[68px] text-center text-sm font-mono font-semibold text-stone-600">
          {label}
        </span>
        <button type="button" onClick={onNext} disabled={atLast || off} title="Next move"
          className={`${base} ${orange} h-9 px-4 gap-1`}>
          <span className="text-sm">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onLast} disabled={atLast || off} title="Last move"
          className={`${base} ${grey} h-9 w-9`}>
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onLive} disabled={atLive || off} title="Live"
        className={`${base} ${grey} w-full mt-2 h-8 gap-1 text-sm`}>
        <CircleDot className="h-3.5 w-3.5" /> Live
      </button>
    </div>
  );
}