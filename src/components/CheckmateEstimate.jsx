import React from 'react';

// Shannon-style theoretical estimate of distinct possible Truth Chess games.
//
// Shannon estimated the game-tree size of standard chess as ~10^120 using an
// average branching factor of ~30 and an average game length of ~80 plies
// (40 moves per side):  30^80 ≈ 10^118.
//
// Truth Chess plays on a 10×9 board (90 squares vs. 64) with an extra piece type
// (Truth, which moves like a Queen) and 20 pieces per side instead of 16. The
// larger board and extra sliding piece raise the average branching factor to
// roughly ~45. Using Shannon's same method:
//
//   45^80 ≈ 10^(80 × log10(45)) ≈ 10^132
//
// The vast majority of randomly played games terminate by checkmate rather
// than stalemate or a draw, so the count of checkmate-ending games is
// approximately the full game-tree size. This is a theoretical estimate, not
// an exact count — the exact figure is mathematically intractable and unknown
// even for standard chess.
const BRANCHING = 45;
const PLIES = 80;
const ESTIMATE = Math.round(PLIES * Math.log10(BRANCHING)); // ≈ 132

export const CHECKMATE_ESTIMATE = ESTIMATE;

export default function CheckmateEstimate() {
  return (
    <div className="w-full max-w-[620px] mx-auto mt-2 px-1">
      <p className="text-[0.65rem] text-center text-stone-400 leading-relaxed">
        Estimated distinct checkmate-ending games:{' '}
        <span className="font-semibold text-stone-600">
          ~10<sup>{ESTIMATE}</sup>
        </span>{' '}
        <span className="text-stone-400/80">(Shannon-style estimate)</span>
      </p>
    </div>
  );
}