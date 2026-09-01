import React from 'react';
import { Link } from 'react-router-dom';

// The compact "How to play" card shown beside the board in Maiden mode.
// Mirrors the standard how-to but adds the Maiden piece rule and a link to
// the Maiden-specific /learn page.
export default function MaidenHowTo() {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 sm:col-span-2 lg:col-span-3">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">How to play — Maiden Mode</p>
      <ul className="space-y-2 text-sm text-stone-600 leading-relaxed">
        <li>• Tap a piece to see its legal moves, then tap a highlighted square to move.</li>
        <li>• Standard chess rules apply on a 10-wide, 9-rank board, including castling and en passant.</li>
        <li>
          • <span className="font-medium text-stone-800">Truth</span> (the † cross piece) moves like a Queen,
          captures only the opposing Truth, and is captured only by the opposing King or Truth. It controls
          the squares it slides to, so it can deliver check and checkmate.
        </li>
        <li>
          • <span className="font-medium text-stone-800">Maiden</span> (the golden-haired piece on the four
          corner squares) moves one square in any direction, like a King. She captures <em>only</em> the
          opposing Truth, and <em>only</em> the opposing Truth can capture her — every other piece simply
          blocks her. She is a mobile, nearly uncapturable blocker you can steer toward the enemy Truth.
        </li>
        <li>• Pawns reaching the last rank promote (choose Q, R, B, N, T for a Truth, or M for a Maiden).</li>
        <li>
          • Draws are detected automatically at threefold repetition and the 50-move rule; use{' '}
          <span className="font-medium text-stone-800">Draw</span> to agree a draw,{' '}
          <span className="font-medium text-stone-800">Hint</span> for a suggested move, and Copy/Email moves
          to export the game.
        </li>
      </ul>
      <Link
        to="/learn?maiden=1"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
      >
        Read the full Maiden guide →
      </Link>
    </div>
  );
}