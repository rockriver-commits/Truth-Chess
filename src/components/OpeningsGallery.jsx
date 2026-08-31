import React from 'react';
import { initialState, makeMove } from '@/lib/chessVariant';
import { OPENINGS } from '@/lib/openings';
import { moveToSAN } from '@/lib/chessNotation';
import MiniBoard from './MiniBoard';

// A curated set of the engine's opening repertoire, each shown as the real
// board position after the scripted opening moves (computed from the same
// opening library the AI plays), with Truth-Chess-specific commentary.
const FEATURED = [
  {
    name: "Queen's Pawn Game",
    desc:
      "White claims the center with the queen's pawn (the e-file) and develops a knight. The e-pawn opens a line for the queen and clears the way for the d-file Truth to slide forward as a blocker. Early self-play favors this move — two wins and a draw from its first three recorded games.",
  },
  {
    name: "King's Pawn Game",
    desc:
      "The most direct central claim: the king's pawn (the f-file) advances two squares, opening lines for the king's-side bishop and bringing the g-file Truth into play early. Both Truth pieces often meet across the open f-file.",
  },
  {
    name: 'Réti Opening',
    desc:
      "A hypermodern start — develop a knight first, let Black build a center, then undermine it from the flanks. The Truth is ideal here: it can be posted behind the knight on a central square almost nothing can remove, cramping Black for the whole game.",
  },
  {
    name: "Queen's Gambit",
    desc:
      "White offers the d-pawn to pull Black's center out of shape. On the wider 10×9 board the gambit opens long lines for both Truth pieces to reach deep blockading squares, so accepting has to be handled with care.",
  },
  {
    name: 'Sicilian Defense',
    desc:
      "Black replies asymmetrically with a side pawn, fighting for the center from an angle. The imbalance gives each side's Truth open diagonals for checks and blockades, so games tend to be sharp and double-edged.",
  },
  {
    name: "Bird's Opening",
    desc:
      "A creative flank start with the g-pawn, aiming at the center from the side and opening a long diagonal for the g-file Truth. Ambitious but risky — the Truth on an open diagonal can deliver early checks, though White lags in central control.",
  },
];

// Replays an opening's scripted moves to produce both the resulting board and
// the SAN move list, using the real engine position so the diagram is exact.
function openingData(name) {
  const op = OPENINGS.find((o) => o.name === name);
  if (!op) return null;
  let st = initialState();
  const sans = [];
  for (const m of op.moves) {
    const piece = st.board[m.from[0]][m.from[1]];
    sans.push(moveToSAN(st, { ...m, piece }));
    st = makeMove(st, m);
  }
  return { board: st.board, sans };
}

export default function OpeningsGallery() {
  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-4">
      {FEATURED.map((f) => {
        const data = openingData(f.name);
        if (!data) return null;
        return (
          <div
            key={f.name}
            className="rounded-xl bg-white/70 ring-1 ring-stone-200 p-4 flex flex-col sm:flex-row gap-4"
          >
            <div className="flex justify-center sm:justify-start shrink-0">
              <MiniBoard board={data.board} />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-stone-800 text-sm">{f.name}</h4>
              <p className="mt-1 font-mono text-[0.68rem] text-stone-500 break-words">
                {data.sans.join(' ')}
              </p>
              <p className="mt-2 text-xs text-stone-600 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}