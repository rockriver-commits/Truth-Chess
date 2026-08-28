// Enhanced Truth Chess AI — iterative-deepening negamax with alpha-beta,
// a transposition table, quiescence search, MVV-LVA move ordering, and
// difficulty levels 1-8. Plays strictly by Truth Chess rules via chessVariant.
import { allLegalMoves, makeMove, inCheck, isSquareAttacked, findKing, cloneBoard, FILES, RANKS } from './chessVariant';
import { consultMateBook, loadAggression, OPENING_PLIES } from './aiLearning';

const VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000, T: 350 };
const MATE = 100000;

// A "hanging check": the moved piece delivers check, is NOT defended by any
// friendly piece, and the opposing King can legally capture it — a free piece
// giveaway. The AI heavily penalises these so it stops handing pieces to the
// King. The move stays legal for everyone (standard rules unchanged).
function isHangingCheck(board, move, color) {
  const [tr, tf] = move.to;
  if (isSquareAttacked(board, tr, tf, color)) return false; // checker is guarded
  const opp = color === 'w' ? 'b' : 'w';
  const kpos = findKing(board, opp);
  if (!kpos) return false;
  if (Math.abs(kpos[0] - tr) > 1 || Math.abs(kpos[1] - tf) > 1) return false; // King not adjacent
  // Simulate the King capturing the checker; legal only if the King is then safe.
  const b = cloneBoard(board);
  b[kpos[0]][kpos[1]] = null;
  b[tr][tf] = { type: 'K', color: opp };
  return !isSquareAttacked(b, tr, tf, color);
}

// Move offsets for the attack map (kept local so we don't import engine internals).
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_OFFSETS = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
const KING_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Reused attack-map buffers: for each square, the minimum attacker value per color
// (a value of 1 represents the king). Truth is excluded — it never threatens N/B/R/Q.
const _wAtk = new Int16Array(FILES * RANKS);
const _bAtk = new Int16Array(FILES * RANKS);

// Difficulty presets. depth = max search depth, randomness = chance to play a
// random legal move (weakens low levels), quiescence = capture-extension on,
// timeMs = soft budget for iterative deepening (caps thinking time on mobile).
export const DIFFICULTIES = {
  1: { depth: 1, randomness: 0.60, quiescence: false, timeMs: 250 },
  2: { depth: 1, randomness: 0.25, quiescence: false, timeMs: 350 },
  3: { depth: 2, randomness: 0.15, quiescence: false, timeMs: 600 },
  4: { depth: 3, randomness: 0.00, quiescence: true,  timeMs: 850 },
  5: { depth: 6, randomness: 0.00, quiescence: true,  timeMs: 1200 },
  6: { depth: 10, randomness: 0.00, quiescence: true,  timeMs: 1800 },
  7: { depth: 15, randomness: 0.00, quiescence: true,  timeMs: 2500 },
  8: { depth: 15, randomness: 0.00, quiescence: true,  timeMs: 4500 },
};

// --- Zobrist hashing for the transposition table ---------------------------
const ZO = (() => {
  const r = () => Math.floor(Math.random() * 0x100000000);
  const t = {};
  for (const c of ['w', 'b']) {
    for (const ty of ['P', 'N', 'B', 'R', 'Q', 'K', 'T']) {
      t[c + ty] = new Uint32Array(FILES * RANKS);
      for (let i = 0; i < FILES * RANKS; i++) t[c + ty][i] = r();
    }
  }
  t.turn = r();
  return t;
})();

function hashState(board, turn) {
  let h = 0;
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (p) h = (h ^ ZO[p.color + p.type][r * FILES + f]) >>> 0;
    }
  }
  if (turn === 'b') h = (h ^ ZO.turn) >>> 0;
  return h;
}

// --- Evaluation -----------------------------------------------------------
// Truth Chess-aware evaluation. Beyond material it includes:
//  • A middlegame king-safety term (edge penalty + pawn shield) that fades as
//    the endgame phase is reached.
//  • An endgame king-activity term: the winning side centralizes its king,
//    drives the enemy king toward the edge/corner, and brings its own king
//    close to support the mate.
//  • A Truth-hunt term: because a Truth (T) piece can only be captured by the
//    opposing King, the engine is rewarded for maneuvering its King toward the
//    enemy's Truth pieces so it can capture them — the signature mechanic of
//    Truth Chess.
//  • A contempt term: the side with a material lead is rewarded for retaining
//    major pieces (Q/R), so it keeps the firepower to force mate instead of
//    trading down to a sterile draw.
function chebyshev(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

// Build per-color attack maps: for each square, the minimum value of an enemy
// piece attacking it (1 = the king). Used by the hanging-piece safety term.
function buildAttackMap(board) {
  _wAtk.fill(0);
  _bAtk.fill(0);
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (!p || p.type === 'T') continue;
      const atk = p.color === 'w' ? _wAtk : _bAtk;
      const val = p.type === 'K' ? 1 : VALUES[p.type];
      const mark = (ar, af) => {
        const j = ar * FILES + af;
        if (atk[j] === 0 || val < atk[j]) atk[j] = val;
      };
      if (p.type === 'P') {
        const dir = p.color === 'w' ? -1 : 1;
        for (const df of [-1, 1]) {
          const ar = r + dir, af = f + df;
          if (ar >= 0 && ar < RANKS && af >= 0 && af < FILES) mark(ar, af);
        }
      } else if (p.type === 'N' || p.type === 'K') {
        const offs = p.type === 'N' ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (const [dr, df] of offs) {
          const ar = r + dr, af = f + df;
          if (ar >= 0 && ar < RANKS && af >= 0 && af < FILES) mark(ar, af);
        }
      } else {
        const dirs = p.type === 'B' ? BISHOP_DIRS : p.type === 'R' ? ROOK_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [dr, df] of dirs) {
          let ar = r + dr, af = f + df;
          while (ar >= 0 && ar < RANKS && af >= 0 && af < FILES) {
            mark(ar, af);
            if (board[ar][af]) break;
            ar += dr; af += df;
          }
        }
      }
    }
  }
}

function evaluate(board) {
  let score = 0;
  const fc = (FILES - 1) / 2; // 4.5
  const rc = (RANKS - 1) / 2; // 4

  // First pass: gather phase info (kings, truth pieces, material, majors).
  let wMat = 0, bMat = 0, wMaj = 0, bMaj = 0;
  let wK = null, bK = null;
  const wT = [], bT = [];
  const wPc = [], bPc = []; // opponent targets for Truth blockades (non-K, non-T)
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (!p) continue;
      const pos = [r, f];
      if (p.type === 'K') { if (p.color === 'w') wK = pos; else bK = pos; continue; }
      if (p.type === 'T') { (p.color === 'w' ? wT : bT).push(pos); }
      else { (p.color === 'w' ? wPc : bPc).push({ pos, type: p.type }); }
      const val = VALUES[p.type];
      if (p.color === 'w') { wMat += val; if (p.type === 'Q' || p.type === 'R') wMaj++; }
      else { bMat += val; if (p.type === 'Q' || p.type === 'R') bMaj++; }
    }
  }

  // Endgame phase: 0 (opening) → 1 (deep endgame). ~2600 ≈ two rooks + minor.
  const totalMat = wMat + bMat;
  const eg = totalMat >= 2600 ? 0 : (2600 - totalMat) / 2600;
  const egPhase = eg > 1 ? 1 : eg;
  const mg = 1 - egPhase;

  // Second pass: per-piece value with phase-weighted king terms.
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (!p) continue;
      let v = VALUES[p.type];
      const centerDist = Math.abs(f - fc) + Math.abs(r - rc);
      const centerness = 4.5 - centerDist;
      if (p.type === 'N' || p.type === 'B') v += centerness * 3;
      else if (p.type === 'P') v += centerness * 4;
      else if (p.type === 'T') v += centerness * 1.5;
      if (p.type === 'P') {
        // White pawns start on row 7 (rank 2), promote at row 0; Black the mirror.
        const adv = p.color === 'w' ? 7 - r : r - 1;
        v += adv * 4;
        // Passed / free-runner pawns. A pawn with a clear file to promotion is a
        // strong "free exchange" candidate — reward it, especially in the endgame.
        const dir = p.color === 'w' ? -1 : 1;
        let clear = true;
        for (let rr = r + dir; rr >= 0 && rr < RANKS; rr += dir) {
          if (board[rr][f]) { clear = false; break; }
        }
        if (clear) {
          v += (adv + 1) * (2 + 8 * egPhase);
        } else {
          let passed = true;
          for (let df = -1; df <= 1 && passed; df++) {
            const nf = f + df;
            if (nf < 0 || nf >= FILES) continue;
            for (let ar = r + dir; ar >= 0 && ar < RANKS; ar += dir) {
              const op = board[ar][nf];
              if (op && op.type === 'P' && op.color !== p.color) { passed = false; break; }
            }
          }
          if (passed) v += (adv + 1) * (1 + 4 * egPhase);
        }
      }
      if (p.type === 'K') {
        if (f <= 1 || f >= 8) v -= 18 * mg; // middlegame: discourage edge king
        const dir = p.color === 'w' ? -1 : 1;
        let shield = 0;
        for (let df = -1; df <= 1; df++) {
          const nf = f + df;
          const nr = r + dir;
          if (nf >= 0 && nf < FILES && nr >= 0 && nr < RANKS) {
            const sp = board[nr][nf];
            if (sp && sp.type === 'P' && sp.color === p.color) shield++;
          }
        }
        v += shield * 12 * mg; // middlegame: pawn shield
        v += centerness * 6 * egPhase; // endgame: centralize the king
      }
      score += p.color === 'w' ? v : -v;
    }
  }

  // Endgame mating drive: the side that is ahead pushes the enemy king out of
  // the center and brings its own king close to support the mate.
  if (wK && bK && egPhase > 0) {
    const wLead = wMat - bMat;
    const kd = chebyshev(wK, bK);
    const closeness = (14 - kd) * 4;
    const bOff = Math.abs(bK[1] - fc) + Math.abs(bK[0] - rc);
    const wOff = Math.abs(wK[1] - fc) + Math.abs(wK[0] - rc);
    if (wLead > 100) score += egPhase * (closeness + bOff * 6);
    else if (wLead < -100) score -= egPhase * (closeness + wOff * 6);
  }

  // Truth hunt: reward maneuvering the King toward enemy Truth pieces so it can
  // capture them (only the King may take a Truth). Closer is better.
  if (egPhase > 0) {
    if (wK) for (const t of bT) {
      const d = chebyshev(wK, t);
      if (d < 10) score += egPhase * (10 - d) * 3;
    }
    if (bK) for (const t of wT) {
      const d = chebyshev(bK, t);
      if (d < 10) score -= egPhase * (10 - d) * 3;
    }
  }

  // Contempt: the side with a lead is rewarded for keeping major pieces, so it
  // retains the firepower to force checkmate rather than trading to a draw.
  // Contempt: the side with a lead is rewarded for keeping major pieces, so it
  // retains the firepower to force checkmate rather than trading to a draw.
  // Scaled by the adaptive aggression multiplier (self-play learning).
  const contempt = 6 * curAggressionMul;
  if (wMat - bMat > 100) score += wMaj * contempt;
  else if (bMat - wMat > 100) score -= bMaj * contempt;

  // Hanging valuable pieces (N/B/R/Q): one attacked by a lesser enemy piece, or
  // attacked by the enemy king with no defender, is "given up for free". Penalize,
  // relaxed when the owner is ~4 pieces up (sacrifices to force mate are fine).
  // Evaluated only for non-quiescence levels — quiescence already resolves these
  // captures at higher levels, so this keeps low levels safe without slowing them.
  if (!useQuiescence) {
    buildAttackMap(board);
    const RELAX = 1300;
    for (let r = 0; r < RANKS; r++) {
      for (let f = 0; f < FILES; f++) {
        const p = board[r][f];
        if (!p || (p.type !== 'N' && p.type !== 'B' && p.type !== 'R' && p.type !== 'Q')) continue;
        const pv = VALUES[p.type];
        const i = r * FILES + f;
        if (p.color === 'w') {
          if (wMat - bMat >= RELAX) continue;
          const ev = _bAtk[i];
          if (ev > 0 && ev < pv) {
            const def = _wAtk[i];
            const unsafe = ev === 1 ? def === 0 : def === 0 || def > ev;
            if (unsafe) score -= (pv - ev) * 0.4;
          }
        } else {
          if (bMat - wMat >= RELAX) continue;
          const ev = _wAtk[i];
          if (ev > 0 && ev < pv) {
            const def = _bAtk[i];
            const unsafe = ev === 1 ? def === 0 : def === 0 || def > ev;
            if (unsafe) score += (pv - ev) * 0.4;
          }
        }
      }
    }
  }

  // --- Truth blockade -----------------------------------------------------
  // Truth pieces are passive blockers (uncapturable except by the enemy King),
  // so the engine should use them to cramp the opponent: sit in front of the
  // opponent's valuable pieces to deny them development and advanced squares,
  // and push into the opponent's half to blockade the center. Strongest in the
  // opening, where blocking setups matters most.
  {
    const opWeight = 1 - egPhase * 0.6; // opening → ~1, deep endgame → ~0.4
    const opPhase = 1 - egPhase;
    for (const t of wT) {
      for (const e of bPc) {
        const d = chebyshev(t, e.pos);
        if (d === 0 || d > 3) continue;
        const val = VALUES[e.type] / 100;
        const forward = t[0] > e.pos[0] ? 1 : 0; // below (white-side of) the black piece
        score += opWeight * (4 - d) * val * (forward ? 2 : 0.5);
      }
      const oppSide = t[0] < rc ? 1 : 0; // in black's half
      const central = 4.5 - Math.abs(t[1] - fc);
      score += opPhase * oppSide * central * 3;
    }
    for (const t of bT) {
      for (const e of wPc) {
        const d = chebyshev(t, e.pos);
        if (d === 0 || d > 3) continue;
        const val = VALUES[e.type] / 100;
        const forward = t[0] < e.pos[0] ? 1 : 0; // above (black-side of) the white piece
        score -= opWeight * (4 - d) * val * (forward ? 2 : 0.5);
      }
      const oppSide = t[0] > rc ? 1 : 0; // in white's half
      const central = 4.5 - Math.abs(t[1] - fc);
      score -= opPhase * oppSide * central * 3;
    }
  }

  // Opening targeting: during the opening, push our pawns toward the chosen
  // enemy piece so they can attack it. Active only when curOpening is set.
  if (curOpening) {
    if (curOpening.wTarget) score += pawnAttackProgress(board, 'w', curOpening.wTarget);
    if (curOpening.bTarget) score -= pawnAttackProgress(board, 'b', curOpening.bTarget);
  }

  return score;
}

// Score a side's pawns by how close their forward attack squares are to the
// current square of the enemy target piece (found by type). Directly attacking
// the target square scores highest; nearer scores more.
function pawnAttackProgress(board, hunter, targetType) {
  const enemy = hunter === 'w' ? 'b' : 'w';
  let sq = null;
  for (let r = 0; r < RANKS && !sq; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (p && p.color === enemy && p.type === targetType) {
        sq = [r, f];
        break;
      }
    }
  }
  if (!sq) return 0; // target captured — no bonus
  const dir = hunter === 'w' ? -1 : 1;
  let total = 0;
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (!p || p.type !== 'P' || p.color !== hunter) continue;
      for (const df of [-1, 1]) {
        const ar = r + dir;
        const af = f + df;
        if (ar < 0 || ar >= RANKS || af < 0 || af >= FILES) continue;
        const d = Math.abs(ar - sq[0]) + Math.abs(af - sq[1]);
        if (d === 0) total += 80;
        else total += Math.max(0, 14 - d * 2);
      }
    }
  }
  return total;
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
let curAggressionMul = 1; // adaptive contempt scaling (from self-play learning)
let curOpening = null; // { wTarget, bTarget } — opening pawn-targeting context
const CHECK_BONUS = 30;
const TT = new Map();
const FLAG = { EXACT: 0, LOWER: 1, UPPER: 2 };
const now = () => performance.now();

function quiesce(state, color, alpha, beta, qsPly = 0) {
  const opp = color === 'w' ? 'b' : 'w';
  const checked = inCheck(state, color);
  const all = allLegalMoves(state, color);
  if (all.length === 0) return checked ? -MATE : 0;
  let moves;
  if (!checked) {
    const stand = evaluate(state.board) * (color === 'w' ? 1 : -1);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    moves = all.filter((m) => m.captured || m.promotion);
    // Include checking moves in the endgame so forcing mate sequences resolve.
    if (qsPly < 2) {
      for (const m of all) {
        if (m.captured || m.promotion) continue;
        if (inCheck(makeMove(state, m), opp)) moves.push(m);
      }
    }
    if (moves.length === 0) return alpha;
  } else {
    moves = all;
  }
  for (const m of orderMoves(moves)) {
    if (now() > deadline) { timedOut = true; break; }
    const ns = makeMove(state, m);
    const sc = -quiesce(ns, opp, -beta, -alpha, qsPly + 1);
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
  const opp = color === 'w' ? 'b' : 'w';
  for (const m of ordered) {
    const ns = makeMove(state, m);
    // Check extension: a checking move gets +1 ply so forcing mate sequences
    // are found within the depth budget.
    const givesCheck = inCheck(ns, opp);
    const ext = givesCheck && ply < 40 ? 1 : 0;
    let sc = -negamax(ns, opp, depth - 1 + ext, -beta, -alpha, ply + 1);
    if (timedOut) break;
    if (givesCheck) {
      if (isHangingCheck(ns.board, m, color)) sc -= VALUES[m.promotion ? 'Q' : m.piece.type];
      else if (aggressive) sc += CHECK_BONUS;
    }
    if (sc > best) { best = sc; bestMove = m; }
    if (best > alpha) { alpha = best; flag = FLAG.EXACT; }
    if (alpha >= beta) { flag = FLAG.LOWER; break; }
  }
  if (!timedOut && bestMove) {
    TT.set(key, { depth, score: best, flag, best: bestMove });
  }
  return best;
}

export function bestMove(state, color, difficulty = 4, aggressiveMode = false, ctx = null) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES[4];
  useQuiescence = cfg.quiescence;
  aggressive = aggressiveMode;
  curAggressionMul = loadAggression().aggressionMul || 1;
  curOpening =
    ctx && ctx.ply != null && ctx.ply < OPENING_PLIES && (ctx.wTarget || ctx.bTarget)
      ? { wTarget: ctx.wTarget || null, bTarget: ctx.bTarget || null }
      : null;
  deadline = now() + cfg.timeMs;
  timedOut = false;
  TT.clear();

  const moves = allLegalMoves(state, color);
  if (moves.length === 0) return null;

  // Mate book: a forced mate-in-1 is always sound to play instantly; deeper
  // remembered mates are used as a strong move-ordering hint (the search
  // re-verifies them), so the engine gravitates toward lines it has solved.
  const bookHit = consultMateBook(state);
  if (bookHit && bookHit.mateIn === 1) return bookHit.move;

  // Weak levels: sometimes just play a random legal move.
  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let ordered = orderMoves(moves);
  if (bookHit) ordered = [bookHit.move, ...ordered.filter((m) => m !== bookHit.move)];
  let best = ordered[0];
  let bestScore = -Infinity;
  for (let d = 1; d <= cfg.depth; d++) {
    let alpha = -Infinity;
    let curBest = null;
    let curBestScore = -Infinity;
    const opp = color === 'w' ? 'b' : 'w';
    for (const m of ordered) {
      const ns = makeMove(state, m);
      const givesCheck = inCheck(ns, opp);
      const ext = givesCheck ? 1 : 0;
      let sc = -negamax(ns, opp, d - 1 + ext, -Infinity, -alpha, 1);
      if (givesCheck) {
        if (isHangingCheck(ns.board, m, color)) sc -= VALUES[m.promotion ? 'Q' : m.piece.type];
        else if (aggressive) sc += CHECK_BONUS;
      }
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