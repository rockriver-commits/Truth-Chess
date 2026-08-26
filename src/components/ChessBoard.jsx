import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', C: '♛' };
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

export default function ChessBoard({ board, selected, legalMoves, lastMove, onSquareClick }) {
  const destSet = new Set(legalMoves.map((m) => `${m.to[0]},${m.to[1]}`));
  const selKey = selected ? `${selected[0]},${selected[1]}` : null;
  const lastSet = lastMove
    ? new Set([`${lastMove.from[0]},${lastMove.from[1]}`, `${lastMove.to[0]},${lastMove.to[1]}`])
    : new Set();

  return (
    <div className="w-full max-w-[620px] mx-auto select-none">
      <div className="grid grid-cols-9 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-stone-100">
        {board.map((row, r) =>
          row.map((piece, f) => {
            const dark = (r + f) % 2 === 1;
            const key = `${r},${f}`;
            const isSel = selKey === key;
            const isDest = destSet.has(key);
            const isLast = lastSet.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSquareClick(r, f)}
                className={[
                  'relative aspect-square flex items-center justify-center transition-colors duration-150',
                  dark ? 'bg-stone-300' : 'bg-stone-50',
                  isLast && !isSel ? 'bg-amber-200/70' : '',
                  isSel ? 'bg-amber-300/90' : '',
                ].join(' ')}
              >
                {piece && (
                  <span
                    className="relative leading-none"
                    style={{
                      fontSize: 'min(8.5vw, 2.7rem)',
                      color: piece.color === 'w' ? '#f8fafc' : '#1f2937',
                      textShadow:
                        piece.color === 'w'
                          ? '0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.85)'
                          : '0 1px 1px rgba(255,255,255,0.25)',
                    }}
                  >
                    {GLYPHS[piece.type]}
                  </span>
                )}
                {piece && piece.type === 'C' && (
                  <span className="absolute top-0.5 right-0.5 text-[0.5rem] font-bold text-amber-700 bg-amber-50 rounded-full px-1 leading-tight border border-amber-500 shadow-sm">
                    N
                  </span>
                )}
                {isDest && !piece && <span className="absolute w-1/3 h-1/3 rounded-full bg-emerald-600/40" />}
                {isDest && piece && (
                  <span className="absolute inset-1 rounded-full ring-2 ring-emerald-600/60" />
                )}
              </button>
            );
          })
        )}
      </div>
      <div className="grid grid-cols-9 mt-1.5">
        {FILES.map((fl) => (
          <div key={fl} className="text-center text-[0.6rem] uppercase tracking-widest text-stone-400">
            {fl}
          </div>
        ))}
      </div>
    </div>
  );
}