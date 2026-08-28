// Self-play learning for the Truth Chess AI.
//   1. Mate book — remembers solved checkmate positions so the engine can
//      instantly recall a forced mate it has already found, and order its
//      search toward remembered mating lines.
//   2. Adaptive aggression — a single "aggression multiplier" that climbs when
//      self-play games end slowly or in draws, and stabilizes once mates get
//      fast, steering the engine toward shorter checkmates over time.
//   3. Opening targeting — during the opening, with a per-game chance, the AI
//      picks a random enemy piece and pushes its pawns to attack it.
import { positionKey, legalMovesFor, RANKS, FILES } from './chessVariant';

const MATE_BOOK_KEY = 'tc-mate-book';
const AGGRO_KEY = 'tc-ai-aggression';

// Opening targeting config.
export const OPENING_PLIES = 20; // first 10 full moves
const OPENING_CHANCE = 0.46; // exactly 46% of games activate targeting
const TARGET_TYPES = ['R', 'N', 'N', 'B', 'Q', 'T']; // weighted toward R/N

// ---------------------------------------------------------------------------
// Mate book
// ---------------------------------------------------------------------------
let _bookCache = null;
function loadMateBook() {
  if (_bookCache) return _bookCache;
  try {
    _bookCache = JSON.parse(localStorage.getItem(MATE_BOOK_KEY) || '{}');
  } catch {
    _bookCache = {};
  }
  return _bookCache;
}
function saveMateBook(b) {
  _bookCache = b;
  try {
    localStorage.setItem(MATE_BOOK_KEY, JSON.stringify(b));
  } catch {
    // storage may be full; keep the in-memory cache
  }
}

// Look up a known mate for the side to move. Returns { move, mateIn } or null.
export function consultMateBook(state) {
  const b = loadMateBook();
  const e = b[positionKey(state)];
  if (!e) return null;
  const legal = legalMovesFor(state, e.from[0], e.from[1]);
  const mv = legal.find((m) => m.to[0] === e.to[0] && m.to[1] === e.to[1]);
  return mv ? { move: mv, mateIn: e.mateIn } : null;
}

// Record the winning line of a finished self-play game. `positionList` is the
// array of { state, lastMove } from game start to the mated position (as
// produced by replayStates). Only the winner's positions are stored, each with
// the move played and how many winner-moves remained to mate.
export function recordMate(positionList) {
  if (!positionList || positionList.length < 2) return;
  const final = positionList[positionList.length - 1].state;
  const loser = final.turn;
  const winner = loser === 'w' ? 'b' : 'w';
  const b = loadMateBook();
  if (Object.keys(b).length > 20000) return; // soft cap
  let changed = false;
  for (let i = 0; i < positionList.length - 1; i++) {
    const st = positionList[i].state;
    if (st.turn !== winner) continue;
    const mv = positionList[i + 1].lastMove;
    if (!mv) continue;
    let mateIn = 0;
    for (let j = i; j < positionList.length; j++) {
      if (positionList[j].state.turn === winner) mateIn++;
    }
    const key = positionKey(st);
    const existing = b[key];
    if (!existing || mateIn < existing.mateIn) {
      b[key] = { from: mv.from, to: mv.to, mateIn };
      changed = true;
    }
  }
  if (changed) saveMateBook(b);
}

// ---------------------------------------------------------------------------
// Adaptive aggression
// ---------------------------------------------------------------------------
export function loadAggression() {
  try {
    const v = JSON.parse(localStorage.getItem(AGGRO_KEY));
    if (v && typeof v.aggressionMul === 'number') return v;
  } catch {
    // fall through to default
  }
  return { aggressionMul: 1, bestMateIn: null, games: 0 };
}

// Update after a self-play game. `mateIn` = plies to mate (null for a draw).
// Aggression climbs when mates are slow or absent, and holds once mates get
// fast — so the engine trends toward the shortest mates it can produce.
export function updateAggression(mateIn) {
  const a = loadAggression();
  a.games = (a.games || 0) + 1;
  const STEP = 0.08;
  const MAX = 2.5;
  if (mateIn == null) {
    a.aggressionMul = Math.min(MAX, a.aggressionMul + STEP * 1.5); // draw → push harder
  } else if (a.bestMateIn == null || mateIn <= a.bestMateIn) {
    a.bestMateIn = mateIn; // new personal best (or tie) — aggression is about right
    a.aggressionMul = Math.min(MAX, a.aggressionMul + STEP * 0.25);
  } else {
    a.aggressionMul = Math.min(MAX, a.aggressionMul + STEP); // slower than best → push harder
  }
  try {
    localStorage.setItem(AGGRO_KEY, JSON.stringify(a));
  } catch {
    // ignore
  }
  return a;
}

// ---------------------------------------------------------------------------
// Opening targeting
// ---------------------------------------------------------------------------
// Roll a per-game target for `hunter`: a random enemy piece type to attack.
// Returns { hunter, type } or null (targeting inactive this game).
export function rollOpeningTarget(hunter, board) {
  if (Math.random() > OPENING_CHANCE) return null;
  const enemy = hunter === 'w' ? 'b' : 'w';
  const types = [];
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (p && p.color === enemy && TARGET_TYPES.includes(p.type)) types.push(p.type);
    }
  }
  if (!types.length) return null;
  return { hunter, type: types[Math.floor(Math.random() * types.length)] };
}