import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };

// Compact captured-pieces card shown to the right of the board. Stacks one
// per side (White captured, Black captured) so the totals sit beside the
// board rather than above/below it.
export default function CapturedSide({ pieces, label }) {
  return (
    <div className="rounded-xl bg-white/80 ring-1 ring-stone-200 shadow-sm p-3 w-32">
      <p className="text-[0.6rem] uppercase tracking-widest text-stone-400 mb-1">{label}</p>
      <div className="min-h-7 flex flex-wrap items-center gap-0.5">
        {pieces.length === 0 ? (
          <span className="text-[0.65rem] text-stone-300">—</span>
        ) : (
          pieces.map((p, i) => (
            <span
              key={i}
              className="leading-none"
              style={{
                fontSize: '1rem',
                color: p.color === 'w' ? '#cbd5e1' : '#475569',
                textShadow: p.color === 'w' ? '0 0 1px rgba(0,0,0,0.6)' : 'none',
              }}
            >
              {GLYPHS[p.type]}
            </span>
          ))
        )}
      </div>
    </div>
  );
}