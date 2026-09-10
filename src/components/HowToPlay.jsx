import React from 'react';
import { Link } from 'react-router-dom';

// The "How to play" summary card shown under the board in non-online modes.
export default function HowToPlay() {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 sm:col-span-2 lg:col-span-3">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">How to play</p>
      <ul className="space-y-2 text-sm text-stone-600 leading-relaxed">
        <li>• Tap a piece to see its legal moves, then tap a highlighted square to move.</li>
        <li>• Standard chess rules apply on a 10-wide, 9-rank board, including castling and en passant.</li>
        <li>
          • <span className="font-medium text-stone-800">Truth</span> (the † cross piece) moves like a
          Queen. It captures only the opposing Truth, and can be captured only by the opposing King
          or an opposing Truth — otherwise it acts as a passive blocker. It controls the squares it
          slides to, so it can deliver check and checkmate. The Truth is free to move from the start, just like any other piece.
        </li>
        <li>• Pawns reaching the last rank promote (choose Q, R, B, N, or T for a Truth).</li>
        <li>• Draws are detected automatically at threefold repetition and the 50-move rule; use <span className="font-medium text-stone-800">Draw</span> to agree a draw, <span className="font-medium text-stone-800">Hint</span> for a suggested move, and <span className="font-medium text-stone-800">Copy moves</span> to export the game, or <span className="font-medium text-stone-800">Email moves</span> to send it to yourself.</li>
      </ul>
      <Link
        to="/learn"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
      >
        Read the full guide →
      </Link>
    </div>
  );
}