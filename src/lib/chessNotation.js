// Standard Algebraic Notation for Truth Chess moves, plus helpers to build
// a full SAN list from a stored move list, classify a move for sound, detect
// threefold repetition, and export a PGN string.
import { initialState, makeMove, gameStatus, allLegalMoves, positionKey } from './chessVariant';

export function squareName([r, f]) {
  return String.fromCharCode(97 + f) + (8 - r);
}

function sameSq(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function addSuffix(state, move, promoType, san) {
  const ns = makeMove(state, move, promoType);
  const st = gameStatus(ns);
  if (st === 'checkmate') return san + '#';
  if (st === 'check') return san + '+';
  return san;
}

// `move` must include the moving `piece` (engine moves do; for stored moves we
// reconstruct it in movesToSAN before calling this).
export function moveToSAN(state, move, promoType = 'Q') {
  if (move.castle === 'K') return addSuffix(state, move, promoType, 'O-O');
  if (move.castle === 'Q') return addSuffix(state, move, promoType, 'O-O-O');
  const piece = move.piece;
  const isPawn = piece.type === 'P';
  let san = '';
  if (!isPawn) san += piece.type;
  // disambiguation among same-type pieces that can also reach the target
  if (!isPawn) {
    const others = allLegalMoves(state, piece.color).filter(
      (m) => m.piece && m.piece.type === piece.type && sameSq(m.to, move.to) && !sameSq(m.from, move.from)
    );
    if (others.length > 0) {
      const sameFile = others.some((m) => m.from[1] === move.from[1]);
      const sameRank = others.some((m) => m.from[0] === move.from[0]);
      if (!sameFile) san += String.fromCharCode(97 + move.from[1]);
      else if (!sameRank) san += String(8 - move.from[0]);
      else san += squareName(move.from);
    }
  }
  if (move.captured) {
    if (isPawn) san += String.fromCharCode(97 + move.from[1]);
    san += 'x';
  }
  san += squareName(move.to);
  if (move.promotion) san += '=' + (promoType || 'Q');
  return addSuffix(state, move, promoType, san);
}

// Build SAN for every move in a stored (serialized) move list.
export function movesToSAN(moves) {
  let state = initialState();
  const sans = [];
  for (const m of moves || []) {
    const piece = state.board[m.from[0]][m.from[1]];
    sans.push(moveToSAN(state, { ...m, piece }, m.promoType || 'Q'));
    state = makeMove(state, m, m.promoType || 'Q');
  }
  return sans;
}

// Classify the last move of a stored move list for sound effects.
export function classifyMove(moves) {
  if (!moves || moves.length === 0) return 'move';
  let state = initialState();
  for (let i = 0; i < moves.length - 1; i++) state = makeMove(state, moves[i], moves[i].promoType || 'Q');
  const m = moves[moves.length - 1];
  const captured = m.ep ? !!state.board[m.capturedAt[0]][m.capturedAt[1]] : !!state.board[m.to[0]][m.to[1]];
  const ns = makeMove(state, m, m.promoType || 'Q');
  const st = gameStatus(ns);
  if (st === 'checkmate') return 'mate';
  if (st === 'stalemate') return 'stale';
  if (st === 'check') return 'check';
  return captured ? 'capture' : 'move';
}

// Threefold repetition: any position occurring 3+ times in the move history.
export function hasThreefold(moves) {
  let st = initialState();
  const counts = new Map();
  counts.set(positionKey(st), 1);
  for (const m of moves || []) {
    st = makeMove(st, m, m.promoType || 'Q');
    const k = positionKey(st);
    const c = (counts.get(k) || 0) + 1;
    if (c >= 3) return true;
    counts.set(k, c);
  }
  return false;
}

// Export a PGN string from a SAN list and a result tag.
export function toPGN(sans, result, extra = {}) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const headers = [
    ['Event', 'Truth Chess'],
    ['Site', 'Truth Chess'],
    ['Date', date],
    ['Result', result],
  ];
  if (extra.white) headers.push(['White', extra.white]);
  if (extra.black) headers.push(['Black', extra.black]);
  let movetext = '';
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) movetext += `${i / 2 + 1}. `;
    movetext += sans[i] + ' ';
  }
  movetext = movetext.trim();
  const body = movetext ? `${movetext} ${result}` : result;
  return headers.map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n' + body;
}