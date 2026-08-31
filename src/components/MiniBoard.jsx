import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function TruthCross({ color }) {
  const fill = color === 'w' ? '#f8fafc' : '#1f2937';
  const stroke = color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.3)';
  return (
    <svg viewBox="0 0 24 24" className="w-[80%] h-[80%]">
      <polygon points="5,23 19,23 12,15" fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      <rect x="10" y="0" width="4" height="23" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1" />
      <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1" />
      <circle cx="12" cy="8.5" r="2.6" fill="#facc15" stroke={stroke} strokeWidth="0.5" />
    </svg>
  );
}

// A compact, read-only 10×9 board diagram with file/rank labels, used to
// illustrate opening positions in the guide. `board` is the 9-row × 10-file
// array from chessVariant (row 0 = Black's back rank at the top).
export default function MiniBoard({ board, square = 20 }) {
  return (
    <div
      className="inline-grid rounded-md overflow-hidden ring-1 ring-stone-300 shadow-sm bg-amber-50"
      style={{
        gridTemplateColumns: `12px repeat(10, ${square}px)`,
        gridTemplateRows: `repeat(9, ${square}px) 12px`,
      }}
    >
      {board.flatMap((row, r) => [
        <div key={`r${r}`} className="flex items-center justify-center text-[0.5rem] text-stone-400">
          {9 - r}
        </div>,
        ...row.map((p, f) => {
          const dark = (r + f) % 2 === 1;
          return (
            <div
              key={`${r}-${f}`}
              className={`flex items-center justify-center ${dark ? 'bg-amber-200' : 'bg-amber-50'}`}
            >
              {p &&
                (p.type === 'T' ? (
                  <TruthCross color={p.color} />
                ) : (
                  <span
                    style={{
                      fontSize: square * 0.7,
                      lineHeight: 1,
                      color: p.color === 'w' ? '#f8fafc' : '#1f2937',
                      textShadow:
                        p.color === 'w'
                          ? '0 0 1px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.5)'
                          : '0 1px 1px rgba(255,255,255,0.2)',
                    }}
                  >
                    {GLYPHS[p.type]}
                  </span>
                ))}
            </div>
          );
        }),
      ])}
      <div key="corner" />
      {FILES.map((fl, i) => (
        <div
          key={`f${i}`}
          className="flex items-center justify-center text-[0.5rem] text-stone-400"
        >
          {fl}
        </div>
      ))}
    </div>
  );
}