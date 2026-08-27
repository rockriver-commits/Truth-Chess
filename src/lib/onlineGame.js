// Helpers for online Truth Chess: join-code generation, move serialization,
// and replaying a stored move list into a full game state (board + captured).
import { initialState, makeMove } from './chessVariant';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

export function generateCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Turn an engine move + chosen promo type into a small storable record.
// applyMove only reads from/to/promotion/castle/ep/capturedAt, so we keep
// just those (plus promoType) — the captured piece is re-derived on replay.
export function serializeMove(move, promoType) {
  const out = { from: move.from, to: move.to };
  if (move.promotion) { out.promotion = true; out.promoType = promoType; }
  if (move.castle) out.castle = move.castle;
  if (move.ep) { out.ep = true; out.capturedAt = move.capturedAt; }
  return out;
}

// Replay a stored move list into { state, captured, lastMove }.
export function replayGame(moves) {
  let state = initialState();
  const captured = { w: [], b: [] };
  let lastMove = null;
  for (const m of moves || []) {
    const mover = state.turn;
    let cap = null;
    if (m.ep) {
      cap = state.board[m.capturedAt[0]][m.capturedAt[1]];
    } else {
      cap = state.board[m.to[0]][m.to[1]];
    }
    if (cap) captured[mover].push(cap);
    state = makeMove(state, m, m.promoType || 'Q');
    lastMove = m;
  }
  return { state, captured, lastMove };
}

// Replay a stored move list into an array of per-move snapshots (including
// the initial position at index 0) — used for post-game step-through review.
export function replayStates(moves) {
  let state = initialState();
  const captured = { w: [], b: [] };
  const list = [{ state, captured: { w: [], b: [] }, lastMove: null }];
  for (const m of moves || []) {
    const mover = state.turn;
    let cap = null;
    if (m.ep) cap = state.board[m.capturedAt[0]][m.capturedAt[1]];
    else cap = state.board[m.to[0]][m.to[1]];
    const next = { w: [...captured.w], b: [...captured.b] };
    if (cap) next[mover].push(cap);
    state = makeMove(state, m, m.promoType || 'Q');
    captured.w = next.w;
    captured.b = next.b;
    list.push({ state, captured: next, lastMove: m });
  }
  return list;
}