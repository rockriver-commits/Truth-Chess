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