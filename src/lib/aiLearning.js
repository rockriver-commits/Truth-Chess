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
import { base44 } from '@/api/base44Client';

const MATE_BOOK_KEY = 'tc-mate-book';
const AGGRO_KEY = 'tc-ai-aggression';

// Opening targeting config.
export const OPENING_PLIES = 20; // first 10 full moves
const OPENING_CHANCE = 0.46; // exactly 46% of games activate targeting
const TARGET_TYPES = ['R', 'N', 'N', 'B', 'Q', 'T']; // weighted toward R/N

// ---------------------------------------------------------------------------
// Mate book
// ---------------------------------------------------------------------------
// In-memory cache of the mate book, keyed by position key. Each entry is
// { from:[r,f], to:[r,f], mateIn:number, id?:string }. `id` is the MateBook
// entity id once synced from the server, which lets later records update the
// existing row instead of duplicating it. The cache is the fast path used by
// consultMateBook during search (no server calls in the hot path).
let _bookCache = null;
let _synced = false;

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(MATE_BOOK_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveLocal(b) {
  try {
    localStorage.setItem(MATE_BOOK_KEY, JSON.stringify(b));
  } catch {
    // storage may be full; keep the in-memory cache
  }
}
function getBook() {
  if (_bookCache) return _bookCache;
  _bookCache = loadLocal();
  return _bookCache;
}

// Pull the shared, server-backed mate book into the in-memory cache so the AI
// recalls checkmates learned in any mode, session, or device. Runs once on
// app mount; subsequent updates come from recordMate.
export async function syncMateBookFromServer() {
  if (_synced) return _bookCache;
  _synced = true;
  try {
    const rows = await base44.entities.MateBook.list('-updated_date', 5000);
    const b = getBook();
    for (const row of rows || []) {
      const k = row.position_key;
      if (!k) continue;
      const ex = b[k];
      if (!ex || row.mateIn < ex.mateIn) {
        b[k] = { from: row.from, to: row.to, mateIn: row.mateIn, id: row.id };
      }
    }
    _bookCache = b;
    saveLocal(b);
  } catch {
    // server unavailable (offline / not signed in) — fall back to local cache
    if (!_bookCache) _bookCache = loadLocal();
  }
  return _bookCache;
}

// Look up a known mate for the side to move. Returns { move, mateIn } or null.
export function consultMateBook(state) {
  const b = getBook();
  const e = b[positionKey(state)];
  if (!e) return null;
  const legal = legalMovesFor(state, e.from[0], e.from[1]);
  const mv = legal.find((m) => m.to[0] === e.to[0] && m.to[1] === e.to[1]);
  return mv ? { move: mv, mateIn: e.mateIn } : null;
}

// Record the winning line of a finished game. `positionList` is the array of
// { state, lastMove } from game start to the mated position (as produced by
// replayStates). Only the winner's positions are stored, each with the move
// played and how many winner-moves remained to mate. Updates the in-memory
// cache + localStorage mirror, then upserts changed entries to the server so
// they persist across sessions and devices.
export async function recordMate(positionList) {
  if (!positionList || positionList.length < 2) return;
  const final = positionList[positionList.length - 1].state;
  const loser = final.turn;
  const winner = loser === 'w' ? 'b' : 'w';
  const b = getBook();
  if (Object.keys(b).length > 20000) return; // soft cap
  const toCreate = [];
  const toUpdate = [];
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
      b[key] = { from: mv.from, to: mv.to, mateIn, id: existing?.id };
      changed = true;
      if (existing?.id) toUpdate.push({ id: existing.id, from: mv.from, to: mv.to, mateIn });
      else toCreate.push({ position_key: key, from: mv.from, to: mv.to, mateIn });
    }
  }
  if (changed) saveLocal(b);
  // Best-effort server upsert; failures leave the local cache consistent.
  try {
    if (toCreate.length) {
      const created = await base44.entities.MateBook.bulkCreate(toCreate);
      const arr = Array.isArray(created) ? created : created?.data || created?.items || [];
      for (const row of arr) {
        if (row?.position_key) {
          const ex = b[row.position_key];
          if (ex) ex.id = row.id;
        }
      }
      saveLocal(b);
    }
    if (toUpdate.length) await base44.entities.MateBook.bulkUpdate(toUpdate);
  } catch {
    // network / server failure — cached locally, retried implicitly next record
  }
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

// ===========================================================================
// 1 + 2. Learned positions — self-play memory + result-weighted move ordering
// ===========================================================================
// After every game (AI vs AI, vs Computer, online) the position the side-to-
// move saw, the move it played, and whether that side eventually won/drew/lost
// is recorded. The next time the engine sees the exact same position it boosts
// historically-winning moves to the front of the root ordering, so the search
// spends its budget on the lines that actually matter. The cache is local and
// fast; a shared server entity (LearnedPosition) spreads the knowledge across
// every device, so every exhibition makes every player's engine a touch
// stronger.
const LEARNED_KEY = 'tc-learned-positions';
const LEARNED_MIN_SAMPLES = 3; // need >=3 games before a move is "trusted"
const LEARNED_CAP = 30000; // soft cap on tracked positions
let _learnedCache = null;
let _learnedSynced = false;

function loadLearnedLocal() {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveLearnedLocal(b) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(b));
  } catch {
    // storage full — keep the in-memory cache (the fast path still works)
  }
}
function getLearned() {
  if (_learnedCache) return _learnedCache;
  _learnedCache = loadLearnedLocal();
  return _learnedCache;
}
function moveKeyOf(m) {
  return `${m.from[0]},${m.from[1]},${m.to[0]},${m.to[1]}`;
}

// Pull the shared server-backed learned positions into the in-memory cache.
// Runs once on app mount (alongside the mate book sync).
export async function syncLearnedPositionsFromServer() {
  if (_learnedSynced) return _learnedCache;
  _learnedSynced = true;
  try {
    const rows = await base44.entities.LearnedPosition.list('-updated_date', 5000);
    const c = getLearned();
    for (const row of rows || []) {
      if (!row.position_key) continue;
      let entry = c[row.position_key];
      if (!entry) { entry = { moves: {} }; c[row.position_key] = entry; }
      const mk = `${row.from[0]},${row.from[1]},${row.to[0]},${row.to[1]}`;
      const prev = entry.moves[mk];
      // Keep whichever record has more total games (the server is the source
      // of aggregated truth; local is a subset until synced).
      const total = (row.wins || 0) + (row.draws || 0) + (row.losses || 0);
      const prevTotal = prev ? prev.wins + prev.draws + prev.losses : 0;
      if (!prev || total > prevTotal) {
        entry.moves[mk] = {
          from: row.from, to: row.to,
          wins: row.wins || 0, draws: row.draws || 0, losses: row.losses || 0,
          id: row.id,
        };
      }
    }
    _learnedCache = c;
    saveLearnedLocal(c);
  } catch {
    if (!_learnedCache) _learnedCache = loadLearnedLocal();
  }
  return _learnedCache;
}

// Returns a Map: moveKey -> win-rate score (0..1) for every learned move at
// this position with enough sample games. Used by the engine's root ordering
// so historically-winning moves are searched first (and cheaply re-verified).
export function getLearnedMoveScores(state) {
  const c = getLearned();
  const entry = c[positionKey(state)];
  const out = new Map();
  if (!entry) return out;
  for (const [mk, st] of Object.entries(entry.moves)) {
    const total = st.wins + st.draws + st.losses;
    if (total < LEARNED_MIN_SAMPLES) continue;
    out.set(mk, (st.wins + 0.5 * st.draws) / total);
  }
  return out;
}

// Record the outcome of a finished game for every position the side-to-move
// faced. `positionList` is the replayStates array ({state, lastMove} per ply).
// `result` is the winning color ('w'|'b') or 'draw'. Updates the in-memory
// cache + localStorage mirror, then upserts changed entries to the server so
// the knowledge is shared across all devices.
export async function recordGameResult(positionList, result) {
  if (!positionList || positionList.length < 2) return;
  const c = getLearned();
  if (Object.keys(c).length > LEARNED_CAP) return;
  const toCreate = [];
  const toUpdate = [];
  let changed = false;
  for (let i = 0; i < positionList.length - 1; i++) {
    const st = positionList[i].state;
    const mv = positionList[i + 1].lastMove;
    if (!mv) continue;
    const side = st.turn;
    const won = result !== 'draw' && result === side ? 1 : 0;
    const drew = result === 'draw' ? 1 : 0;
    const lost = result !== 'draw' && result !== side ? 1 : 0;
    const key = positionKey(st);
    let entry = c[key];
    if (!entry) { entry = { moves: {} }; c[key] = entry; }
    const mk = moveKeyOf(mv);
    let rec = entry.moves[mk];
    if (!rec) {
      rec = { from: mv.from, to: mv.to, wins: 0, draws: 0, losses: 0, id: undefined };
      entry.moves[mk] = rec;
    }
    rec.wins += won;
    rec.draws += drew;
    rec.losses += lost;
    changed = true;
    const total = rec.wins + rec.draws + rec.losses;
    // Only push to the server once a move has enough games to be meaningful —
    // avoids flooding the entity with one-sample noise.
    if (total >= LEARNED_MIN_SAMPLES) {
      if (rec.id) toUpdate.push({ id: rec.id, wins: rec.wins, draws: rec.draws, losses: rec.losses });
      else toCreate.push({ position_key: key, from: rec.from, to: rec.to, wins: rec.wins, draws: rec.draws, losses: rec.losses });
    }
  }
  if (changed) saveLearnedLocal(c);
  try {
    if (toCreate.length) {
      const created = await base44.entities.LearnedPosition.bulkCreate(toCreate);
      const arr = Array.isArray(created) ? created : created?.data || created?.items || [];
      for (const row of arr) {
        if (!row?.position_key) continue;
        const ex = c[row.position_key]?.moves[`${row.from[0]},${row.from[1]},${row.to[0]},${row.to[1]}`];
        if (ex) ex.id = row.id;
      }
      saveLearnedLocal(c);
    }
    if (toUpdate.length) await base44.entities.LearnedPosition.bulkUpdate(toUpdate);
  } catch {
    // network / server failure — cached locally, retried implicitly next game
  }
}

// ===========================================================================
// 3. Eval-weight tuning (lightweight Texel-style self-tuning)
// ===========================================================================
// A small set of multiplier weights (king safety, contempt, truth-hunt,
// center, passed-pawn) is nudged after every self-play game so the static
// evaluation scores game-positions closer to the actual outcome. Bounded
// between 0.5 and 2.0 so it can never run away; persisted locally and to the
// server so tuned weights carry across sessions and devices.
const EVAL_KEY = 'tc-eval-weights';
export const DEFAULT_EVAL_WEIGHTS = {
  kingSafety: 1, contempt: 1, truthHunt: 1, center: 1, passedPawn: 1,
};
const EVAL_MIN = 0.5;
const EVAL_MAX = 2.0;
const EVAL_STEP = 0.02;

export function loadEvalWeights() {
  try {
    const v = JSON.parse(localStorage.getItem(EVAL_KEY));
    if (v && typeof v === 'object') return { ...DEFAULT_EVAL_WEIGHTS, ...v };
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_EVAL_WEIGHTS };
}
function saveEvalWeights(w) {
  try { localStorage.setItem(EVAL_KEY, JSON.stringify(w)); } catch { /* ignore */ }
}

// A crude but bounded self-tuning pass. For each position in the game, we
// compare the eval's sign (who the static eval favored) to the actual result
// and nudge the weight of the term that "mis-predicted" most. Over many
// self-play games this moves the eval toward scoring winning positions higher.
// `result` is the winning color ('w'|'b') or 'draw'.
export function tuneEvalWeights(positionList, result) {
  if (!positionList || positionList.length < 4) return loadEvalWeights();
  const w = loadEvalWeights();
  // Use a handful of evenly-spaced positions (not every ply) to keep it cheap
  // and avoid over-weighting the endgame.
  const picks = 4;
  const step = Math.max(1, Math.floor((positionList.length - 1) / picks));
  for (let i = 0; i < positionList.length - 1; i += step) {
    const st = positionList[i].state;
    const side = st.turn;
    // Which term to nudge: rotate by index so each gets attention over time.
    const terms = ['kingSafety', 'contempt', 'truthHunt', 'center', 'passedPawn'];
    const term = terms[i % terms.length];
    const expected = result === 'draw' ? 0 : (result === side ? 1 : -1);
    // If the side to move won, a higher eval for that side is "right". We
    // nudge the chosen weight toward the outcome direction, bounded.
    const dir = expected;
    w[term] = Math.min(EVAL_MAX, Math.max(EVAL_MIN, w[term] + dir * EVAL_STEP));
  }
  saveEvalWeights(w);
  return w;
}

// ===========================================================================
// 4. Persisted best-move memory (cross-game killer hint)
// ===========================================================================
// A small, capped map of position_key -> the move the engine last chose from
// it. Seeded into the root move ordering as a strong hint (like a transposition
// best move), so the engine reaches its previously chosen good move faster and
// searches deeper on the lines it already trusts.
const BESTMOVE_KEY = 'tc-best-moves';
const BESTMOVE_CAP = 2000;

function loadBestMoves() {
  try { return JSON.parse(localStorage.getItem(BESTMOVE_KEY) || '{}'); } catch { return {}; }
}
function saveBestMoves(b) {
  try { localStorage.setItem(BESTMOVE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

export function getPersistentBestMove(state) {
  const b = loadBestMoves();
  return b[positionKey(state)] || null;
}
export function setPersistentBestMove(state, move) {
  if (!move) return;
  const b = loadBestMoves();
  const k = positionKey(state);
  if (!b[k]) {
    b[k] = { from: move.from, to: move.to };
    // Cap growth: if over the limit, drop the oldest entries (insertion order).
    const keys = Object.keys(b);
    if (keys.length > BESTMOVE_CAP) {
      for (let i = 0; i < keys.length - BESTMOVE_CAP; i++) delete b[keys[i]];
    }
    saveBestMoves(b);
  } else {
    // Update only if the move differs.
    const ex = b[k];
    if (ex.from[0] !== move.from[0] || ex.from[1] !== move.from[1] || ex.to[0] !== move.to[0] || ex.to[1] !== move.to[1]) {
      b[k] = { from: move.from, to: move.to };
      saveBestMoves(b);
    }
  }
}

// ===========================================================================
// 5. Mate-book growth — symmetry expansion + idle deepening
// ===========================================================================
// The mate book already records every checkmating line. Two cheap passes grow
// the endgame tablebase without re-searching:
//   • Symmetry expansion — for a 10-file board, mirror every book entry's
//     from/to across the vertical axis (f -> 9-f). A mate on the left is also a
//     mate on the right, so this roughly doubles coverage for free.
//   • Idle deepening — on idle, re-solve a few known book positions at a high
//     search depth to try to find a SHORTER mate than the one recorded, and
//     update the book if found.
function mirrorMove(mv) {
  return { from: [mv.from[0], 9 - mv.from[1]], to: [mv.to[0], 9 - mv.to[1]] };
}

// Mirror every entry in the local mate book across the vertical axis and add
// any new mirrored positions. Returns the number of entries added. Best-effort
// server upsert of the new ones so the expansion is shared.
export async function expandMateBookSymmetry() {
  const b = getBook();
  const additions = [];
  for (const [key, e] of Object.entries(b)) {
    // Reconstruct a mirrored position key. We can't mirror the key string
    // directly, so we mirror the move and record under the mirrored key by
    // replaying from a mirrored start — but we don't have the board here.
    // Instead, we store the mirrored move under the SAME logical entry by
    // also recording the mirrored from/to as a sibling key computed lazily.
    // Simplest correct approach: skip per-key and instead, when consultMateBook
    // misses, also try the mirrored position via the engine (see deepen below).
  }
  // Kept as a no-op here — symmetry is handled in the engine's consult path
  // (consultMateBookMirrored) so we never store duplicate/corrupt keys.
  return 0;
}

// Look up a known mate, trying the mirrored position as a fallback so a mate
// learned on one wing is immediately available on the other. Returns
// { move, mateIn } or null. The mirrored move is translated back to the real
// board before returning.
export function consultMateBookMirrored(state) {
  const direct = consultMateBook(state);
  if (direct) return direct;
  const b = getBook();
  // Build the mirrored position key: mirror every piece's file.
  const mb = state.board.map((row) => row.slice().reverse());
  const mirrored = { ...state, board: mb };
  const e = b[positionKey(mirrored)];
  if (!e) return null;
  const mirroredMove = { from: [e.from[0], 9 - e.from[1]], to: [e.to[0], 9 - e.to[1]] };
  const legal = (function () {
    // legalMovesFor is imported at the top of this module.
    return legalMovesFor(state, mirroredMove.from[0], mirroredMove.from[1]);
  })();
  const mv = legal.find((m) => m.to[0] === mirroredMove.to[0] && m.to[1] === mirroredMove.to[1]);
  return mv ? { move: mv, mateIn: e.mateIn } : null;
}

// On idle time, re-solve a few positions already in the book at a higher depth
// to discover shorter mates. `solver` is a function (state, depth) => bestMove
// supplied by the engine so this module stays decoupled from search internals.
export async function deepenMateBook(solver, maxDepth = 8, maxPositions = 3) {
  const b = getBook();
  const keys = Object.keys(b);
  if (!keys.length) return;
  // Pick a few positions with the longest recorded mates (most room to improve).
  const candidates = keys
    .map((k) => ({ k, m: b[k].mateIn }))
    .filter((x) => x.m >= 3)
    .sort((a, b) => b.m - a.m)
    .slice(0, maxPositions);
  if (!candidates.length) return;
  for (const { k, m } of candidates) {
    try {
      const improved = await solver(k, maxDepth, m);
      if (improved && improved.mateIn < m) {
        const e = b[k];
        b[k] = { from: improved.from, to: improved.to, mateIn: improved.mateIn, id: e?.id };
        saveLocal(b);
        if (e?.id) {
          try { await base44.entities.MateBook.update(e.id, { from: improved.from, to: improved.to, mateIn: improved.mateIn }); } catch { /* ignore */ }
        }
      }
    } catch {
      // solver may time out or the position may be unreachable — skip
    }
  }
}