// Enhanced Truth Chess AI — iterative-deepening negamax with alpha-beta,
// a transposition table, quiescence search, MVV-LVA move ordering, and
// difficulty levels 1-8. Plays strictly by Truth Chess rules via chessVariant.
import { allLegalMoves, makeMove, inCheck, isSquareAttacked, findKing, cloneBoard, positionKey, FILES, RANKS } from './chessVariant';
import {
  consultMateBook,
  consultMateBookMirrored,
  loadAggression,
  OPENING_PLIES,
  getLearnedMoveScores,
  getPersistentBestMove,
  setPersistentBestMove,
  loadEvalWeights,
} from './aiLearning';

const VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000, T: 350, M: 200 };
const MATE = 100000;
// Truth-as-blocker is prioritized over Truth-as-checker: the blockade terms in
// evaluate() are scaled up by this factor, and Truth-delivered checks get a
// reduced aggression bonus below.
const TRUTH_BLOCK_BOOST = 1.7;

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
  // Every level plays strong from the start — full quiescence search, no
  // random moves. Each level searches a little deeper (and a little longer)
  // than the one below it, so difficulty scales smoothly from 1 (strong) to
  // 10 (strongest).
  1:  { depth: 4,  randomness: 0.00, quiescence: true, timeMs: 700 },
  2:  { depth: 5,  randomness: 0.00, quiescence: true, timeMs: 850 },
  3:  { depth: 6,  randomness: 0.00, quiescence: true, timeMs: 1000 },
  4:  { depth: 7,  randomness: 0.00, quiescence: true, timeMs: 1200 },
  5:  { depth: 8,  randomness: 0.00, quiescence: true, timeMs: 1500 },
  6:  { depth: 10, randomness: 0.00, quiescence: true, timeMs: 1900 },
  7:  { depth: 12, randomness: 0.00, quiescence: true, timeMs: 2400 },
  8:  { depth: 14, randomness: 0.00, quiescence: true, timeMs: 3100 },
  9:  { depth: 16, randomness: 0.00, quiescence: true, timeMs: 4000 },
  10: { depth: 18, randomness: 0.00, quiescence: true, timeMs: 5500 },
};

// --- Zobrist hashing for the transposition table ---------------------------
const ZO = (() => {
  const r = () => Math.floor(Math.random() * 0x100000000);
  const t = {};
  for (const c of ['w', 'b']) {
    for (const ty of ['P', 'N', 'B', 'R', 'Q', 'K', 'T', 'M']) {
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
      if (!p || p.type === 'T' || p.type === 'M') continue;
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

// Does a Truth of `color` attack (r,f) via an unblocked queen-style slide?
// (Truth moves like a queen, so this is the same line scan; the piece on the
// target square itself is skipped so a Truth doesn't "attack" its own square.)
function truthAttacksSquare(board, r, f, color) {
  for (const [dr, df] of ROOK_DIRS.concat(BISHOP_DIRS)) {
    let ar = r + dr, af = f + df;
    while (ar >= 0 && ar < RANKS && af >= 0 && af < FILES) {
      const p = board[ar][af];
      if (p) {
        if (p.type === 'T' && p.color === color) return true;
        break;
      }
      ar += dr; af += df;
    }
  }
  return false;
}

function evaluate(board) {
  let score = 0;
  const fc = (FILES - 1) / 2; // 4.5
  const rc = (RANKS - 1) / 2; // 4

  // First pass: gather phase info (kings, truth pieces, material, majors).
  let wMat = 0, bMat = 0, wMaj = 0, bMaj = 0;
  let wK = null, bK = null;
  const wT = [], bT = [];
  const wM = [], bM = []; // Maiden positions (king-distraction goal)
  const wPc = [], bPc = []; // opponent targets for Truth blockades (non-K, non-T)
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (!p) continue;
      const pos = [r, f];
      if (p.type === 'K') { if (p.color === 'w') wK = pos; else bK = pos; continue; }
      if (p.type === 'T') { (p.color === 'w' ? wT : bT).push(pos); }
      else if (p.type === 'M') { (p.color === 'w' ? wM : bM).push(pos); }
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
      if (p.type === 'N' || p.type === 'B') v += centerness * 3 * curWeights.center;
      else if (p.type === 'P') v += centerness * 4 * curWeights.center;
      else if (p.type === 'T') v += centerness * 1.5 * curWeights.center;
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
          v += (adv + 1) * (2 + 8 * egPhase) * curWeights.passedPawn;
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
          if (passed) v += (adv + 1) * (1 + 4 * egPhase) * curWeights.passedPawn;
        }
      }
      if (p.type === 'K') {
        if (f <= 1 || f >= 8) v -= 18 * mg * curWeights.kingSafety; // middlegame: discourage edge king
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
        v += shield * 12 * mg * curWeights.kingSafety; // middlegame: pawn shield
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
      if (d < 10) score += egPhase * (10 - d) * 3 * curWeights.truthHunt;
    }
    if (bK) for (const t of wT) {
      const d = chebyshev(bK, t);
      if (d < 10) score -= egPhase * (10 - d) * 3 * curWeights.truthHunt;
    }
  }

  // Contempt: the side with a lead is rewarded for keeping major pieces, so it
  // retains the firepower to force checkmate rather than trading to a draw.
  // Contempt: the side with a lead is rewarded for keeping major pieces, so it
  // retains the firepower to force checkmate rather than trading to a draw.
  // Scaled by the adaptive aggression multiplier (self-play learning) and the
  // tunable contempt weight (Texel-style self-tuning).
  const contempt = 6 * curAggressionMul * curWeights.contempt;
  if (wMat - bMat > 100) score += wMaj * contempt;
  else if (bMat - wMat > 100) score -= bMaj * contempt;

  // Hanging major pieces (R/N/B/Q) and Truth (T): a piece attacked by a lesser
  // enemy piece, or by the enemy king with no defender, is "given up for free" —
  // the attacker should be guarded or the trade should be fair. Penalize that,
  // relaxed when the owner is ~4 pieces up (sacrifices to force mate are fine).
  // Evaluated only for non-quiescence levels — quiescence already resolves these
  // captures at higher levels, so this keeps low levels safe without slowing them.
  if (!useQuiescence) {
    buildAttackMap(board);
    const RELAX = 1300;
    for (let r = 0; r < RANKS; r++) {
      for (let f = 0; f < FILES; f++) {
        const p = board[r][f];
        if (!p) continue;
        const isMajor = p.type === 'N' || p.type === 'B' || p.type === 'R' || p.type === 'Q';
        const isTruth = p.type === 'T';
        if (!isMajor && !isTruth) continue;
        const pv = VALUES[p.type];
        const i = r * FILES + f;
        if (isMajor) {
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
        } else {
          // Truth (T) is only capturable by the enemy King or an enemy Truth.
          // A Truth attacking an opponent's major piece should be guarded (by
          // our King or our Truth) or the trade should be fair — penalize a
          // Truth that is attacked with no recapture available.
          if (p.color === 'w' && wMat - bMat >= RELAX) continue;
          if (p.color === 'b' && bMat - wMat >= RELAX) continue;
          const enemy = p.color === 'w' ? 'b' : 'w';
          const atkMap = p.color === 'w' ? _bAtk : _wAtk;
          const defMap = p.color === 'w' ? _wAtk : _bAtk;
          const kingAtk = atkMap[i] === 1;
          const truthAtk = truthAttacksSquare(board, r, f, enemy);
          if (!kingAtk && !truthAtk) continue;
          const guarded = defMap[i] === 1 || truthAttacksSquare(board, r, f, p.color);
          if (!guarded) {
            if (p.color === 'w') score -= pv * 0.4;
            else score += pv * 0.4;
          }
        }
      }
    }
  }

  // Always-on Truth safety: avoid leaving a Truth where the enemy King or
  // enemy Truth can capture it without a friendly King/Truth to recapture —
  // the variant's signature "unfair trade." Quiescence catches captures at
  // the leaves; this is the static safety net that runs at every level.
  {
    for (const t of wT) {
      const [r, f] = t;
      const kThreat = bK && chebyshev(bK, [r, f]) === 1;
      const tThreat = truthAttacksSquare(board, r, f, 'b');
      if (!kThreat && !tThreat) continue;
      const defended = (wK && chebyshev(wK, [r, f]) === 1) || truthAttacksSquare(board, r, f, 'w');
      if (!defended) score -= VALUES.T * 0.5;
    }
    for (const t of bT) {
      const [r, f] = t;
      const kThreat = wK && chebyshev(wK, [r, f]) === 1;
      const tThreat = truthAttacksSquare(board, r, f, 'w');
      if (!kThreat && !tThreat) continue;
      const defended = (bK && chebyshev(bK, [r, f]) === 1) || truthAttacksSquare(board, r, f, 'b');
      if (!defended) score += VALUES.T * 0.5;
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
        score += opWeight * (4 - d) * val * (forward ? 2 : 0.5) * TRUTH_BLOCK_BOOST;
      }
      const oppSide = t[0] < rc ? 1 : 0; // in black's half
      const central = 4.5 - Math.abs(t[1] - fc);
      score += opPhase * oppSide * central * 3 * TRUTH_BLOCK_BOOST;
    }
    for (const t of bT) {
      for (const e of wPc) {
        const d = chebyshev(t, e.pos);
        if (d === 0 || d > 3) continue;
        const val = VALUES[e.type] / 100;
        const forward = t[0] < e.pos[0] ? 1 : 0; // above (black-side of) the white piece
        score -= opWeight * (4 - d) * val * (forward ? 2 : 0.5) * TRUTH_BLOCK_BOOST;
      }
      const oppSide = t[0] > rc ? 1 : 0; // in white's half
      const central = 4.5 - Math.abs(t[1] - fc);
      score -= opPhase * oppSide * central * 3 * TRUTH_BLOCK_BOOST;
    }
  }

  // --- Maiden king-distraction -------------------------------------------
  // The Maiden's main goal is to reach the opposing King. She can't capture
  // him (she only takes the opposing Truth, and only the opposing Truth can
  // take her), so the King can't remove her either — making her a perfect
  // passive blocker. Sitting next to the enemy King she gets in his way,
  // cramps his escape squares, and distracts him into a juicy endgame. The
  // pull is always on (it's her reason for being) but grows toward the
  // endgame, where a cramped king decides the game.
  {
    const MAIDEN_PROX = 5;
    const MAIDEN_ADJ = 20;
    const phaseMix = 0.4 + 0.6 * egPhase; // always her goal, strongest in the endgame
    for (const m of wM) {
      if (!bK) break;
      const d = chebyshev(m, bK);
      score += phaseMix * (9 - d) * MAIDEN_PROX;
      if (d <= 1) score += phaseMix * MAIDEN_ADJ;
      else if (d <= 2) score += phaseMix * MAIDEN_ADJ * 0.5;
    }
    for (const m of bM) {
      if (!wK) break;
      const d = chebyshev(m, wK);
      score -= phaseMix * (9 - d) * MAIDEN_PROX;
      if (d <= 1) score -= phaseMix * MAIDEN_ADJ;
      else if (d <= 2) score -= phaseMix * MAIDEN_ADJ * 0.5;
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

// --- Move ordering --------------------------------------------------------
// Captures/promotions first (MVV-LVA), then the TT move, killer moves, and a
// history table for quiet moves — the classic ordering that lets alpha-beta
// prune aggressively and powers late-move reductions.
const MAX_PLY = 64;
let killers = [];
let historyTab = new Int32Array(FILES * RANKS * FILES * RANKS);

function sameMove(a, b) {
  return a && b && a.from[0] === b.from[0] && a.from[1] === b.from[1]
    && a.to[0] === b.to[0] && a.to[1] === b.to[1];
}
function histIdx(m) {
  return (m.from[0] * FILES + m.from[1]) * (FILES * RANKS) + (m.to[0] * FILES + m.to[1]);
}
function scoreMove(m, ply, ttMove) {
  if (m === ttMove) return 1e9;
  if (m.captured) return 100000 + VALUES[m.captured.type] * 100 - (VALUES[m.piece.type] || 0);
  if (m.promotion) return 90000;
  const k = killers[ply] || [null, null];
  if (k[0] && sameMove(m, k[0])) return 80000;
  if (k[1] && sameMove(m, k[1])) return 79000;
  return historyTab[histIdx(m)] || 0;
}
function orderMoves(moves, ply = 0, ttMove = null) {
  return moves
    .map((m) => ({ m, s: scoreMove(m, ply, ttMove) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

// --- Search state (module-level; one search at a time) --------------------
let deadline = 0;
let timedOut = false;
let nodeCount = 0;
const MAX_NODES = 500000; // hard cap so a heavy quiescence can never freeze the tab
let useQuiescence = true;
let aggressive = false;
let curAggressionMul = 1; // adaptive contempt scaling (from self-play learning)
let curOpening = null; // { wTarget, bTarget } — opening pawn-targeting context
// Tunable eval weights (self-play Texel-style tuning) and the learned
// win-rate scores for the root position, both populated at the start of each
// bestMove call so the hot evaluate() path never touches storage.
let curWeights = { kingSafety: 1, contempt: 1, truthHunt: 1, center: 1, passedPawn: 1 };
let curLearnedScores = null; // Map moveKey -> 0..1, or null
const CHECK_BONUS = 30;
const TT = new Map();
const FLAG = { EXACT: 0, LOWER: 1, UPPER: 2 };
const now = () => performance.now();

function quiesce(state, color, alpha, beta, qsPly = 0) {
  // Check the budget BEFORE the expensive allLegalMoves call — otherwise a
  // deep capture line can blow far past the deadline and freeze the UI long
  // enough that the computer appears to stop moving.
  if (now() > deadline || ++nodeCount > MAX_NODES) { timedOut = true; return alpha; }
  if (qsPly > 12) return alpha;
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

// A side has "non-pawn material" if it owns at least one piece that can move
// freely (N/B/R/Q/T) — used to avoid null-move zugzwang in bare K+P endings.
function hasNonPawnMaterial(state, color) {
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = state.board[r][f];
      if (p && p.color === color && p.type !== 'P' && p.type !== 'K') return true;
    }
  }
  return false;
}

function negamax(state, color, depth, alpha, beta, ply) {
  if (now() > deadline || ++nodeCount > MAX_NODES) { timedOut = true; return alpha; }
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
  const opp = color === 'w' ? 'b' : 'w';
  const checked = inCheck(state, color);

  // Null-move pruning: when not in check and with material to spare, pass the
  // turn at reduced depth — if the opponent still can't beat beta, prune the
  // whole node. Skipped at the root (ply 0) and in bare K/P endings.
  if (!checked && depth >= 3 && ply > 0 && hasNonPawnMaterial(state, color)) {
    const nullState = { ...state, turn: opp, ep: null };
    const R = 2;
    const nullScore = -negamax(nullState, opp, depth - 1 - R, -beta, -beta + 1, ply + 1);
    if (timedOut) return alpha;
    if (nullScore >= beta) return beta;
  }

  const ordered = orderMoves(moves, ply, ttMove);
  let best = -Infinity;
  let bestMove = null;
  let flag = FLAG.UPPER;
  let searched = 0;
  for (const m of ordered) {
    const ns = makeMove(state, m);
    // Check extension: a checking move gets +1 ply so forcing mate sequences
    // are found within the depth budget.
    const givesCheck = inCheck(ns, opp);
    const ext = givesCheck && ply < 40 ? 1 : 0;
    const isQuiet = !m.captured && !m.promotion && m !== ttMove;
    // Late-move reductions: quiet moves searched late get a shallower look,
    // with a full re-search if they surprisingly beat alpha.
    const lmr = isQuiet && depth >= 3 && searched >= 3 && !givesCheck ? 1 : 0;
    let sc;
    if (lmr) {
      sc = -negamax(ns, opp, depth - 1 + ext - 1, -alpha - 1, -alpha, ply + 1);
      if (!timedOut && sc > alpha) sc = -negamax(ns, opp, depth - 1 + ext, -beta, -alpha, ply + 1);
    } else {
      sc = -negamax(ns, opp, depth - 1 + ext, -beta, -alpha, ply + 1);
    }
    if (timedOut) break;
    if (givesCheck) {
      if (isHangingCheck(ns.board, m, color)) sc -= VALUES[m.promotion ? 'Q' : m.piece.type];
      else if (aggressive) sc += (m.piece.type === 'T' ? CHECK_BONUS * 0.3 : CHECK_BONUS);
    }
    if (sc > best) { best = sc; bestMove = m; }
    if (best > alpha) { alpha = best; flag = FLAG.EXACT; }
    if (alpha >= beta) {
      flag = FLAG.LOWER;
      // Record quiet cutoffs as killers + history so sibling nodes try them
      // earlier — the ordering that makes alpha-beta prune hardest.
      if (isQuiet) {
        const k = killers[ply] || (killers[ply] = [null, null]);
        if (!sameMove(m, k[0])) { k[1] = k[0]; k[0] = m; }
        historyTab[histIdx(m)] += depth * depth;
      }
      break;
    }
    searched++;
  }
  if (!timedOut && bestMove) {
    TT.set(key, { depth, score: best, flag, best: bestMove });
  }
  return best;
}

// A move "draws" if it triggers the 50-move rule, or if the resulting position
// has already occurred twice this game (threefold repetition). The AI avoids
// such moves unless every legal move draws.
function isDrawingMove(state, move, positionKeys) {
  const ns = makeMove(state, move, move.promotion ? 'Q' : 'Q');
  if ((ns.halfmove || 0) >= 100) return true;
  if (positionKeys && positionKeys.length) {
    const k = positionKey(ns);
    let occ = 0;
    for (const hk of positionKeys) if (hk === k) occ++;
    if (occ >= 2) return true;
  }
  return false;
}

// Prefer the chosen move; if it draws, pick the first (best-ordered)
// alternative that doesn't. If every move draws, play the chosen one.
function pickNonDrawing(state, preferred, ordered, positionKeys) {
  if (!preferred) return ordered[0];
  if (!isDrawingMove(state, preferred, positionKeys)) return preferred;
  const alt = ordered.find((m) => !isDrawingMove(state, m, positionKeys));
  return alt || preferred;
}

// --- Pawn-grab safety (root move filter) ---------------------------------
// Valuable pieces (N/B/R/Q) should not grab defended pawns that lose material
// — a knight taking a pawn only to be recaptured by a rook trades a minor for
// a pawn. The engine avoids such grabs at the root unless that's all there is.
// Truth is excluded (it never captures ordinary pieces), and a capturer that
// is already under attack is allowed to salvage a pawn.

function leastValuableAttacker(board, tr, tf, color) {
  const pdir = color === 'w' ? 1 : -1; // a white pawn attacking (tr,tf) sits at tr+1
  for (const df of [-1, 1]) {
    const r = tr + pdir, f = tf + df;
    if (r >= 0 && r < RANKS && f >= 0 && f < FILES) {
      const p = board[r][f];
      if (p && p.type === 'P' && p.color === color) return { r, f, type: 'P' };
    }
  }
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const r = tr + dr, f = tf + df;
    if (r >= 0 && r < RANKS && f >= 0 && f < FILES) {
      const p = board[r][f];
      if (p && p.type === 'N' && p.color === color) return { r, f, type: 'N' };
    }
  }
  for (const [dr, df] of BISHOP_DIRS) {
    let r = tr + dr, f = tf + df;
    while (r >= 0 && r < RANKS && f >= 0 && f < FILES) {
      const p = board[r][f];
      if (p) { if (p.color === color && (p.type === 'B' || p.type === 'Q')) return { r, f, type: p.type }; break; }
      r += dr; f += df;
    }
  }
  for (const [dr, df] of ROOK_DIRS) {
    let r = tr + dr, f = tf + df;
    while (r >= 0 && r < RANKS && f >= 0 && f < FILES) {
      const p = board[r][f];
      if (p) { if (p.color === color && (p.type === 'R' || p.type === 'Q')) return { r, f, type: p.type }; break; }
      r += dr; f += df;
    }
  }
  for (const [dr, df] of KING_OFFSETS) {
    const r = tr + dr, f = tf + df;
    if (r >= 0 && r < RANKS && f >= 0 && f < FILES) {
      const p = board[r][f];
      if (p && p.type === 'K' && p.color === color) return { r, f, type: 'K' };
    }
  }
  return null;
}

// Static exchange evaluation of a capture (no x-ray attackers). Returns the
// net material from the mover's perspective; negative means the capture loses
// material. A king recapture ends the exchange (the king can't be recaptured).
function see(state, move) {
  if (!move.captured) return 0;
  const [tr, tf] = move.to;
  const board = cloneBoard(state.board);
  const mover = move.piece.color;
  let side = mover === 'w' ? 'b' : 'w';
  const a = [VALUES[move.captured.type]];
  board[tr][tf] = { type: move.piece.type, color: mover };
  board[move.from[0]][move.from[1]] = null;
  while (a.length < 32) {
    const atk = leastValuableAttacker(board, tr, tf, side);
    if (!atk) break;
    const onSquare = board[tr][tf];
    if (atk.type === 'K') {
      const other = side === 'w' ? 'b' : 'w';
      if (isSquareAttacked(board, tr, tf, other)) break; // king can't safely recapture
      a.push(VALUES[onSquare.type]);
      break; // king recapture ends the exchange
    }
    a.push(VALUES[onSquare.type]);
    board[tr][tf] = { type: atk.type, color: side };
    board[atk.r][atk.f] = null;
    side = side === 'w' ? 'b' : 'w';
  }
  if (a.length === 1) return a[0];
  const f = new Array(a.length);
  f[a.length - 1] = a[a.length - 1];
  for (let k = a.length - 2; k >= 1; k--) f[k] = Math.max(0, a[k] - f[k + 1]);
  return a[0] - f[1];
}

function isBadPawnGrab(state, move, opp) {
  if (!move.captured || move.captured.type !== 'P') return false;
  const pt = move.piece.type;
  if (pt !== 'N' && pt !== 'B' && pt !== 'R' && pt !== 'Q') return false;
  // A capturer already under attack may salvage a pawn — only filter grabs
  // that initiate a losing exchange from a safe square.
  if (isSquareAttacked(state.board, move.from[0], move.from[1], opp)) return false;
  return see(state, move) < 0;
}

export function bestMove(state, color, difficulty = 4, aggressiveMode = false, ctx = null) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES[4];
  useQuiescence = cfg.quiescence;
  aggressive = aggressiveMode;
  curAggressionMul = loadAggression().aggressionMul || 1;
  curWeights = loadEvalWeights();
  curLearnedScores = getLearnedMoveScores(state);
  curOpening =
    ctx && ctx.ply != null && ctx.ply < OPENING_PLIES && (ctx.wTarget || ctx.bTarget)
      ? { wTarget: ctx.wTarget || null, bTarget: ctx.bTarget || null }
      : null;
  deadline = now() + cfg.timeMs;
  timedOut = false;
  nodeCount = 0;
  TT.clear();
  killers = Array.from({ length: MAX_PLY + 8 }, () => [null, null]);
  historyTab = new Int32Array(FILES * RANKS * FILES * RANKS);

  const moves = allLegalMoves(state, color);
  if (moves.length === 0) return null;

  // Root move filter: valuable pieces (N/B/R/Q) must not grab defended pawns
  // that lose material (a knight taking a pawn only to be recaptured by a
  // rook trades a minor for a pawn). Such grabs are dropped from the root
  // move list unless every move is one. Truth is excluded; a capturer already
  // under attack may salvage a pawn.
  const oppCol = color === 'w' ? 'b' : 'w';
  const safeRoot = moves.filter((m) => !isBadPawnGrab(state, m, oppCol));
  const rootMoves = safeRoot.length ? safeRoot : moves;

  // Mate book (with mirrored fallback): a forced mate-in-1 is always sound to
  // play instantly; deeper remembered mates are used as a strong move-ordering
  // hint (the search re-verifies them), so the engine gravitates toward lines
  // it has solved — now also covering the symmetric wing of the board.
  const bookHit = consultMateBookMirrored(state);
  if (bookHit && bookHit.mateIn === 1) {
    setPersistentBestMove(state, bookHit.move);
    return bookHit.move; // a forced mate is never a draw
  }

  // Position keys so far (including the current position) for threefold
  // detection. Absent for callers that don't pass history — then only the
  // 50-move rule is checked.
  const pkeys = ctx && ctx.positionKeys ? ctx.positionKeys : null;

  // Weak levels: sometimes play a random legal move — but never one that
  // draws (threefold / 50-move) unless every move draws.
  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    return pickNonDrawing(state, rootMoves[Math.floor(Math.random() * rootMoves.length)], rootMoves, pkeys);
  }

  let ordered = orderMoves(rootMoves);
  // Result-weighted root ordering: learned self-play win-rates promote
  // historically-winning moves to the front of the search (the search still
  // re-verifies them), and a persisted best-move hint seeds the ordering like a
  // transposition-table best move so the engine reaches its trusted move fast.
  if (curLearnedScores && curLearnedScores.size) {
    ordered = rootMoves
      .map((m) => ({ m, s: 1e6 * (curLearnedScores.get(`${m.from[0]},${m.from[1]},${m.to[0]},${m.to[1]}`) || 0) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.m);
  }
  const persistHint = getPersistentBestMove(state);
  if (persistHint) {
    const hi = ordered.find(
      (m) => m.from[0] === persistHint.from[0] && m.from[1] === persistHint.from[1] && m.to[0] === persistHint.to[0] && m.to[1] === persistHint.to[1]
    );
    if (hi) ordered = [hi, ...ordered.filter((m) => m !== hi)];
  }
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
        else if (aggressive) sc += (m.piece.type === 'T' ? CHECK_BONUS * 0.3 : CHECK_BONUS);
      }
      if (timedOut && d > 1) break;
      if (sc > curBestScore) { curBestScore = sc; curBest = m; }
      if (curBestScore > alpha) alpha = curBestScore;
    }
    // Only adopt this depth's result if a root move actually completed — a
    // heavy quiescence can time out before any score is produced, leaving
    // curBest null; in that case keep the previous depth's best (or the
    // top-ordered move) so the engine always returns a legal move.
    if (curBest && (!timedOut || d === 1)) { best = curBest; bestScore = curBestScore; }
    if (curBest) ordered = [curBest, ...ordered.filter((m) => m !== curBest)];
    if (timedOut) break;
    if (Math.abs(bestScore) > MATE - 1000) break;
  }
  const chosen = pickNonDrawing(state, best || ordered[0], ordered, pkeys);
  // Persist the chosen move so the next game reaches it faster (cross-game
  // move memory). Skipped for one-off mate-in-1 hits (already persisted above).
  setPersistentBestMove(state, chosen);
  return chosen;
}