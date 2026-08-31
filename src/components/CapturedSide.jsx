import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };

// Mini cross matching the Truth piece used on the board, so a captured Truth
// isn't mistaken for a king.
function TruthGlyph({ color }) {
  const stroke = color === 'w' ? '#e2e8f0' : '#1f2937';
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" style={{ display: 'inline-block', verticalAlign: '-0.15em' }} aria-label="Truth">
      <polygon points="5,23 19,23 12,15" fill={stroke} />
      <rect x="10" y="0" width="4" height="23" rx="1.5" fill={stroke} />
      <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill={stroke} />
      <circle cx="12" cy="8.5" r="2.6" fill="#facc15" />
    </svg>
  );
}

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
              {p.type === 'T' ? <TruthGlyph color={p.color} /> : GLYPHS[p.type]}
            </span>
          ))
        )}
      </div>
    </div>
  );
}