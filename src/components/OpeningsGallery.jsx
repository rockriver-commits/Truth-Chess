import React from 'react';
import { initialState, makeMove } from '@/lib/chessVariant';
import { moveToSAN } from '@/lib/chessNotation';
import MiniBoard from './MiniBoard';

// Ten Truth-centered openings. Each moves a Truth (or both Truths) into either
// an attacking post (Offense) or a square that shields the king (Defense).
// Moves are [row, file] on the 9×10 board; boards are computed from the real
// initial position so every diagram is exact.
const OPENINGS = [
  {
    name: "Truth's Lance",
    category: 'Offense',
    moves: [
      { from: [7, 3], to: [5, 3], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 3], to: [6, 3], color: 'w' },
      { from: [1, 4], to: [2, 4], color: 'b' },
    ],
    desc:
      "White opens the d-file with the d-pawn, then sends the d-Truth straight up it to d3. From this advanced central post the Truth dominates the open file — it can't be captured by ordinary pieces, so it cramps Black's center and threatens to slide further into Black's half. A textbook example of using the Truth as an unstoppable attacking block.",
  },
  {
    name: 'Diagonal Strike',
    category: 'Offense',
    moves: [
      { from: [7, 5], to: [5, 5], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [8, 6], to: [5, 3], color: 'w' },
      { from: [1, 3], to: [2, 3], color: 'b' },
    ],
    desc:
      "White's f-pawn advance clears the long diagonal, and the g-Truth slides up-left to d4 — a powerful central square. From d4 the Truth radiates attack across the center and toward both enemy flanks, while staying safe from capture by anything but the enemy king or Truth. It turns a quiet opening into immediate central pressure.",
  },
  {
    name: "Truth's Fork",
    category: 'Offense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [8, 3], to: [5, 6], color: 'w' },
      { from: [1, 5], to: [2, 5], color: 'b' },
    ],
    desc:
      "After advancing the e-pawn, White develops the d-Truth up-right to g4, a kingside attacking post. From g4 it eyes the enemy kingside and controls long diagonals toward Black's king position, giving White early attacking chances while keeping the Truth active and hard to remove.",
  },
  {
    name: "Truth's Storm",
    category: 'Offense',
    moves: [
      { from: [7, 3], to: [5, 3], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
      { from: [8, 3], to: [6, 3], color: 'w' },
      { from: [0, 6], to: [2, 6], color: 'b' },
    ],
    desc:
      "Both sides race their Truth pieces forward — White's d-Truth to d3 and Black's g-Truth to g7 — creating a tense central standoff. Each Truth is an uncapturable attacker, so the position bristles with mutual threats. This is the most double-edged of the offense openings, where both kings must watch the central battle.",
  },
  {
    name: "Truth's Wing",
    category: 'Offense',
    moves: [
      { from: [7, 2], to: [5, 2], color: 'w' },
      { from: [1, 2], to: [3, 2], color: 'b' },
      { from: [8, 3], to: [6, 1], color: 'w' },
      { from: [1, 3], to: [2, 3], color: 'b' },
    ],
    desc:
      "White advances the c-pawn and swings the d-Truth up-left to b3, pressuring the queenside flank. A Truth on the wing is awkward for the opponent: it can't be traded away, and it controls long queenside lines that can later support a pawn storm or an attack down the b- and a-files.",
  },
  {
    name: "King's Shield",
    category: 'Defense',
    moves: [
      { from: [7, 5], to: [6, 5], color: 'w' },
      { from: [1, 5], to: [2, 5], color: 'b' },
      { from: [8, 6], to: [7, 5], color: 'w' },
      { from: [0, 6], to: [1, 5], color: 'b' },
    ],
    desc:
      "White nudges the f-pawn one square, then steps the g-Truth directly in front of the king to f2. A Truth on f2 is the simplest king shield — it blocks the file in front of the king and, since almost nothing can capture it, forms a near-permanent wall. Both sides adopt the same shield, leading to a solid, maneuvering game.",
  },
  {
    name: "Truth's Wall",
    category: 'Defense',
    moves: [
      { from: [7, 4], to: [6, 4], color: 'w' },
      { from: [1, 4], to: [2, 4], color: 'b' },
      { from: [8, 3], to: [7, 4], color: 'w' },
      { from: [0, 3], to: [1, 4], color: 'b' },
    ],
    desc:
      "White advances the e-pawn one square and relocates the d-Truth to e2, building a wall in front of the queen and king's sector. From e2 the Truth blocks central invasions along the e-file and guards the squares in front of the king, blunting early enemy attacks before they start.",
  },
  {
    name: "Truth's Fortress",
    category: 'Defense',
    moves: [
      { from: [7, 7], to: [6, 7], color: 'w' },
      { from: [1, 7], to: [2, 7], color: 'b' },
      { from: [8, 6], to: [7, 7], color: 'w' },
      { from: [0, 6], to: [1, 7], color: 'b' },
    ],
    desc:
      "White gives the h-pawn a luft and drops the g-Truth to h2, guarding the kingside diagonal. A Truth on h2 shuts down bishop and queen attacks aimed at the king's corner along the long diagonal — a quiet but very safe defensive setup that discourages early sacrifices.",
  },
  {
    name: "Truth's Rampart",
    category: 'Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [8, 3], to: [6, 4], color: 'w' },
      { from: [0, 3], to: [2, 4], color: 'b' },
    ],
    desc:
      "White pushes the e-pawn two squares and posts the d-Truth on e3, blocking the central file in front of the king's sector. From e3 the Truth halts enemy pieces driving down the open e-file and keeps the king's front sealed, trading a little space for a lot of safety.",
  },
  {
    name: "Truth's Bastion",
    category: 'Defense',
    moves: [
      { from: [7, 5], to: [5, 5], color: 'w' },
      { from: [1, 5], to: [3, 5], color: 'b' },
      { from: [8, 6], to: [6, 5], color: 'w' },
      { from: [0, 6], to: [2, 5], color: 'b' },
    ],
    desc:
      "White advances the f-pawn two squares and plants the g-Truth on f3, a solid block just in front of the king. From f3 the Truth shields the king, controls the central e4 and g4 squares, and can later step back to f2 if needed — a flexible defensive post that strengthens as the game goes on.",
  },
];

function openingData(op) {
  let st = initialState();
  const sans = [];
  for (const m of op.moves) {
    const piece = st.board[m.from[0]][m.from[1]];
    sans.push(moveToSAN(st, { ...m, piece }));
    st = makeMove(st, m);
  }
  return { board: st.board, sans };
}

function OpeningCard({ op }) {
  const { board, sans } = openingData(op);
  const isOffense = op.category === 'Offense';
  return (
    <div className="rounded-xl bg-white/70 ring-1 ring-stone-200 p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h4 className="font-semibold text-stone-800">{op.name}</h4>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isOffense ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {op.category}
        </span>
      </div>
      <div className="flex justify-center mb-4">
        <MiniBoard board={board} square={28} />
      </div>
      <p className="font-mono text-xs text-stone-500 mb-3 break-words">{sans.join(' ')}</p>
      <p className="text-sm text-stone-600 leading-relaxed">{op.desc}</p>
    </div>
  );
}

export default function OpeningsGallery() {
  const offense = OPENINGS.filter((o) => o.category === 'Offense');
  const defense = OPENINGS.filter((o) => o.category === 'Defense');
  return (
    <div className="mt-4 space-y-8">
      <section>
        <h3 className="font-semibold text-stone-800 mb-1">Offense openings</h3>
        <p className="text-sm text-stone-500 mb-4">
          A Truth advances into an attacking post, pressuring the enemy center and king.
        </p>
        <div className="space-y-5">
          {offense.map((o) => (
            <OpeningCard key={o.name} op={o} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="font-semibold text-stone-800 mb-1">Defense openings</h3>
        <p className="text-sm text-stone-500 mb-4">
          A Truth moves to shield the king, blocking attacks before they start.
        </p>
        <div className="space-y-5">
          {defense.map((o) => (
            <OpeningCard key={o.name} op={o} />
          ))}
        </div>
      </section>
    </div>
  );
}