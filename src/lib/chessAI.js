// A simple material + position AI for Truth Chess using negamax with alpha-beta.
import { allLegalMoves, makeMove, inCheck } from './chessVariant';

const VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000, T: 350 };

function evaluate(board) {
  let score = 0;
  for (let r = 0; r < board.length; r++) {
    for (let f = 0; f < board[r].length; f++) {
      const p = board[r][f];
      if (!p) continue;
      let v = VALUES[p.type];
      const centerDist = Math.abs(f - 4) + Math.abs(r - 3.5);
      v += (4 - centerDist) * (p.type === 'P' ? 3 : 1);
      if (p.type === 'P') {
        const adv = p.color === 'w' ? 6 - r : r - 1;
        v += adv * 2;
      }
      score += p.color === 'w' ? v : -v;
    }
  }
  return score;
}

function negamax(board, color, depth, alpha, beta) {
  const moves = allLegalMoves(board, color);
  if (moves.length === 0) return inCheck(board, color) ? -100000 : 0;
  if (depth === 0) return evaluate(board) * (color === 'w' ? 1 : -1);
  let best = -Infinity;
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  for (const m of moves) {
    const nb = makeMove(board, m);
    const score = -negamax(nb, color === 'w' ? 'b' : 'w', depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(board, color, depth = 2) {
  const moves = allLegalMoves(board, color);
  if (moves.length === 0) return null;
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const nb = makeMove(board, m);
    const score = -negamax(nb, color === 'w' ? 'b' : 'w', depth - 1, -beta, -alpha);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return best;
}