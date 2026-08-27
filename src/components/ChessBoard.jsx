import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };
const LETTERS = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P', T: 'T' };
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

import { getBoardTheme } from '@/components/ThemePicker';

function Cross({ color }) {
  const fill = color === 'w' ? '#f8fafc' : '#1f2937';
  const stroke = color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)';
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[60%] h-[60%]"
      style={color === 'w' ? { filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))' } : undefined}
    >
      <polygon points="5,23 19,23 12,15" fill={fill} stroke={stroke} strokeWidth="0.6" strokeLinejoin="round" />
      <rect x="10" y="0" width="4" height="23" rx="1.5" fill={fill} stroke={stroke} strokeWidth="0.6" />
      <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="0.6" />
      <circle cx="12" cy="8.5" r="1.4" fill="#facc15" stroke={stroke} strokeWidth="0.3" />
    </svg>
  );
}

export default function ChessBoard({
  board,
  selected,
  legalMoves,
  lastMove,
  onSquareClick,
  flipped = false,
  checkSquare = null,
  hintMove = null,
  boardTheme = 'classic',
  pieceStyle = 'figurine',
}) {
  const theme = getBoardTheme(boardTheme);
  const destSet = new Set(legalMoves.map((m) => `${m.to[0]},${m.to[1]}`));
  const selKey = selected ? `${selected[0]},${selected[1]}` : null;
  const lastSet = lastMove
    ? new Set([`${lastMove.from[0]},${lastMove.from[1]}`, `${lastMove.to[0]},${lastMove.to[1]}`])
    : new Set();
  const checkKey = checkSquare ? `${checkSquare[0]},${checkSquare[1]}` : null;
  const hintSet = hintMove
    ? new Set([`${hintMove.from[0]},${hintMove.from[1]}`, `${hintMove.to[0]},${hintMove.to[1]}`])
    : new Set();

  const fileLabels = flipped ? [...FILES].reverse() : FILES;

  return (
    <div className="w-full max-w-[620px] mx-auto select-none">
      <div className="grid grid-cols-10 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10">
        {Array.from({ length: 8 }).map((_, di) =>
          Array.from({ length: 10 }).map((_, dj) => {
            const r = flipped ? 7 - di : di;
            const f = flipped ? 9 - dj : dj;
            const dark = (r + f) % 2 === 1;
            const key = `${r},${f}`;
            const isSel = selKey === key;
            const isDest = destSet.has(key);
            const isLast = lastSet.has(key);
            const isCheck = checkKey === key;
            const isHint = hintSet.has(key);
            const piece = board[r][f];

            let bg = dark ? theme.dark : theme.light;
            if (isLast && !isSel) bg = 'rgba(251,191,36,0.35)';
            if (isSel) bg = 'rgba(251,191,36,0.55)';
            if (isCheck) bg = 'rgba(244,63,94,0.55)';

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSquareClick(r, f)}
                className="relative aspect-square flex items-center justify-center transition-colors duration-150"
                style={{ backgroundColor: bg }}
              >
                {dj === 0 && (
                  <span
                    className="absolute top-0.5 left-1 text-[0.55rem] font-semibold"
                    style={{ color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.45)' }}
                  >
                    {8 - r}
                  </span>
                )}
                {isHint && (
                  <span className="absolute inset-0 ring-2 ring-emerald-500/70 rounded-sm pointer-events-none" />
                )}
                {piece &&
                  (piece.type === 'T' ? (
                    <Cross color={piece.color} />
                  ) : (
                    <span
                      className="relative leading-none"
                      style={{
                        fontSize: pieceStyle === 'letter' ? 'min(6vw, 1.6rem)' : 'min(7.8vw, 2.5rem)',
                        fontWeight: pieceStyle === 'letter' ? 700 : 400,
                        fontFamily: pieceStyle === 'letter' ? 'ui-monospace, monospace' : undefined,
                        color: piece.color === 'w' ? '#f8fafc' : '#1f2937',
                        textShadow:
                          piece.color === 'w'
                            ? '0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.85)'
                            : '0 1px 1px rgba(255,255,255,0.25)',
                      }}
                    >
                      {pieceStyle === 'letter' ? LETTERS[piece.type] : GLYPHS[piece.type]}
                    </span>
                  ))}
                {isDest && !piece && <span className="absolute w-1/3 h-1/3 rounded-full bg-emerald-600/40" />}
                {isDest && piece && <span className="absolute inset-1 rounded-full ring-2 ring-emerald-600/60" />}
              </button>
            );
          })
        )}
      </div>
      <div className="grid grid-cols-10 mt-1.5">
        {fileLabels.map((fl) => (
          <div key={fl} className="text-center text-[0.6rem] uppercase tracking-widest text-stone-400">
            {fl}
          </div>
        ))}
      </div>
    </div>
  );
}