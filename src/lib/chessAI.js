// Enhanced Truth Chess AI — iterative-deepening negamax with alpha-beta,
// a transposition table, quiescence search, MVV-LVA move ordering, and
// difficulty levels 1-8. Plays strictly by Truth Chess rules via chessVariant.
import { allLegalMoves, makeMove, inCheck } from './chessVariant';

const VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000, T: 350 };
const MATE = 100000;

// Difficulty presets. depth = max search depth, randomness = chance to play a
// random legal move (weakens low levels), quiescence = capture-extension on,
// timeMs = soft budget for iterative deepening (caps thinking time on mobile).
export const DIFFICULTIES = {
  1: { depth: 1, randomness: 0.60, quiescence: false, timeMs: 250 },
  2: { depth: 1, randomness: 0.25, quiescence: false, timeMs: 350 },
  3: { depth: 2, randomness: 0.15, quiescence: false, timeMs: 600 },
  4: { depth: 2, randomness: 0.00, quiescence: true,  timeMs: 850 },
  5: { depth: 3, randomness: 0.00, quiescence: true,  timeMs: 1100 },
  6: { depth: 3, randomness: 0.00, quiescence: true,  timeMs: 1500 },
  7: { depth: 4, randomness: 0.00, quiescence: true,  timeMs: 1900 },
  8: { depth: 4, randomness: 0.00, quiescence: true,  timeMs: 2500 },
};

// --- Zobrist hashing for the transposition table ---------------------------
const ZO = (() => {
  const r = () => Math.floor(Math.random() * 0x100000000);
  const t = {};
  for (const c of ['w', 'b']) {
    for (const ty of ['P', 'N', 'B', 'R', 'Q', 'K', 'T']) {
      t[c + ty] = new Uint32Array(80);
      for (let i = 0; i < 80; i++) t[c + ty][i] = r();
    }
  }
  t.turn = r();
  return t;
})();

function hashState(board, turn) {
  let h = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 10; f++) {
      const p = board[r][f];
      if (p) h = (h ^ ZO[p.color + p.type][r * 10 + f]) >>> 0;
    }
  }
  if (turn === 'b') h = (h ^ ZO.turn) >>> 0;
  return h;
}

// --- Evaluation -----------------------------------------------------------
function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 10; f++) {
      const p = board[r][f];
      if (!p) continue;
      let v = VALUES[p.type];
      const centerDist = Math.abs(f - 4.5) + Math.abs(r - 3.5);
      const centerness = 4.5 - centerDist;
      if (p.type === 'N' || p.type === 'B') v += centerness * 3;
      else if (p.type === 'P') v += centerness * 4;
      else if (p.type === 'T') v += centerness * 1.5;
      if (p.type === 'P') {
        const adv = p.color === 'w' ? 6 - r : r - 1;
        v += adv * 4;
      }
      if (p.type === 'K') {
        if (f <= 1 || f >= 8) v -= 18; // discourage edge castling-averse king
        const dir = p.color === 'w' ? -1 : 1;
        let shield = 0;
        for (let df = -1; df <= 1; df++) {
          const nf = f + df;
          const nr = r + dir;
          if (nf >= 0 && nf < 10 && nr >= 0 && nr < 8) {
            const sp = board[nr][nf];
            if (sp && sp.type === 'P' && sp.color === p.color) shield++;
          }
        }
        v += shield * 12;
      }
      score += p.color === 'w' ? v : -v;
    }
  }
  return score;
}

// --- Move ordering (MVV-LVA for captures, promotions high) -----------------
function orderMoves(moves) {
  return moves
    .map((m) => {
      let s = 0;
      if (m.captured) s = 10000 + VALUES[m.captured.type] * 10 - (VALUES[m.piece.type] || 0);
      if (m.promotion) s += 9000;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

// --- Search state (module-level; one search at a time) --------------------
let deadline = 0;
let timedOut = false;
let useQuiescence = true;
let aggressive = false;
const CHECK_BONUS = 30;
const TT = new Map();
const FLAG = { EXACT: 0, LOWER: 1, UPPER: 2 };
const now = () => performance.now();

function quiesce(state, color, alpha, beta) {
  const checked = inCheck(state, color);
  let moves = allLegalMoves(state, color);
  if (moves.length === 0) return checked ? -MATE : 0;
  if (!checked) {
    const stand = evaluate(state.board) * (color === 'w' ? 1 : -1);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    moves = moves.filter((m) => m.captured || m.promotion);
    if (moves.length === 0) return alpha;
  }
  for (const m of orderMoves(moves)) {
    if (now() > deadline) { timedOut = true; break; }
    const ns = makeMove(state, m);
    const sc = -quiesce(ns, color === 'w' ? 'b' : 'w', -beta, -alpha);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function negamax(state, color, depth, alpha, beta, ply) {
  if (now() > deadline) { timedOut = true; return alpha; }
  const key = hashState(state.board, state.turn);
  const tt = TT.get(key);
  let ttMove = null;
  if (tt) {
    if (tt.depth >= depth) {
      if (tt.flag === FLAG.EXACT) return tt.score;
      if (tt.flag === FLAG.LOWER && tt.score >= beta) return tt.score;
      if (tt.flag === FLAG.UPPER && tt.score <= alpha) return tt.score;
    }
    ttMove = tt.best;
  }
  const moves = allLegalMoves(state, color);
  if (moves.length === 0) return inCheck(state, color) ? -MATE + ply : 0;
  if (depth <= 0) {
    return useQuiescence
      ? quiesce(state, color, alpha, beta)
      : evaluate(state.board) * (color === 'w' ? 1 : -1);
  }
  const ordered = orderMoves(moves);
  if (ttMove) ordered.unshift(ttMove);
  let best = -Infinity;
  let bestMove = null;
  let flag = FLAG.UPPER;
  for (const m of ordered) {
    const ns = makeMove(state, m);
    const sc = -negamax(ns, color === 'w' ? 'b' : 'w', depth - 1, -beta, -alpha, ply + 1);
    if (timedOut) break;
    if (aggressive && inCheck(ns, color === 'w' ? 'b' : 'w')) sc += CHECK_BONUS;
    if (sc > best) { best = sc; bestMove = m; }
    if (best > alpha) { alpha = best; flag = FLAG.EXACT; }
    if (alpha >= beta) { flag = FLAG.LOWER; break; }
  }
  if (!timedOut && bestMove) {
    TT.set(key, { depth, score: best, flag, best: bestMove });
  }
  return best;
}

export function bestMove(state, color, difficulty = 4, aggressiveMode = false) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES[4];
  useQuiescence = cfg.quiescence;
  aggressive = aggressiveMode;
  deadline = now() + cfg.timeMs;
  timedOut = false;
  TT.clear();

  const moves = allLegalMoves(state, color);
  if (moves.length === 0) return null;

  // Weak levels: sometimes just play a random legal move.
  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let ordered = orderMoves(moves);
  let best = ordered[0];
  let bestScore = -Infinity;
  for (let d = 1; d <= cfg.depth; d++) {
    let alpha = -Infinity;
    let curBest = null;
    let curBestScore = -Infinity;
    for (const m of ordered) {
      const ns = makeMove(state, m);
      let sc = -negamax(ns, color === 'w' ? 'b' : 'w', d - 1, -Infinity, -alpha, 1);
      if (aggressive && inCheck(ns, color === 'w' ? 'b' : 'w')) sc += CHECK_BONUS;
      if (timedOut && d > 1) break;
      if (sc > curBestScore) { curBestScore = sc; curBest = m; }
      if (curBestScore > alpha) alpha = curBestScore;
    }
    if (!timedOut || d === 1) { best = curBest; bestScore = curBestScore; }
    if (curBest) ordered = [curBest, ...ordered.filter((m) => m !== curBest)];
    if (timedOut) break;
    if (Math.abs(bestScore) > MATE - 1000) break;
  }
  return best;
}