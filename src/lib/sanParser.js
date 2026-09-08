// Parser for Truth Chess game notation (SAN / PGN) — the reverse of
// chessNotation's moveToSAN. Accepts standard SAN plus the loose style players
// paste in (capture 'x' optional, check/mate suffixes ignored, capture source
// files sometimes dropped). Ambiguous moves are resolved by trying each
// candidate and keeping the one that applies the rest of the game. Returns the
// stored move list used everywhere else (serializeMove shape), or throws an
// Error naming the first token that couldn't be applied.
import { initialState, makeMove, allLegalMoves, RANKS } from './chessVariant';
import { serializeMove } from './onlineGame';

const MOVE_RE = /^([KQRBTN])?([a-j])?([1-9])?(x)?([a-j])([1-9])(?:=?([KQRBTN]))?$/;
const SKIP_TOKENS = new Set(['*', '1-0', '0-1', '1/2-1/2', '(', ')', 'e.p.']);

// Strip PGN header lines, comments, move numbers, and result markers, leaving
// just the move tokens.
function tokenize(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('['));
  return lines
    .join(' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\d+\.\.\./g, ' ')
    .replace(/\d+\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[+#!?]+$/g, ''))
    .filter((t) => t && !SKIP_TOKENS.has(t));
}

// Resolve one SAN token to every matching legal move. Capture markers are
// ignored, so "Qf3" and "Qxf3" both match a capturing queen move to f3;
// disambiguation (file/rank) is honored when present. A bare pawn token (no
// source file) means a push by convention — when both a push and captures
// match, only pushes are kept; otherwise every matching capture becomes a
// branch the caller tries in turn.
function candidatesFor(state, tok, idx) {
  if (/^(O-O-O|0-0-0|O-O|0-0)$/.test(tok)) {
    const want = tok.length > 3 ? 'Q' : 'K';
    const mv = allLegalMoves(state, state.turn).find((m) => m.castle === want);
    if (!mv) throw new Error(`Move ${idx} "${tok}" is not legal in this position.`);
    return [{ move: mv, promoType: 'Q' }];
  }
  const m = tok.match(MOVE_RE);
  if (!m) throw new Error(`Move ${idx} "${tok}" is not valid notation.`);
  const [, piece, disFile, disRank, , destFile, destRank, promo] = m;
  const dest = [RANKS - Number(destRank), destFile.charCodeAt(0) - 97];
  const legal = allLegalMoves(state, state.turn).filter((mv) => {
    const p = mv.piece || state.board[mv.from[0]][mv.from[1]];
    if (!p) return false;
    if (p.type !== (piece || 'P')) return false;
    if (mv.to[0] !== dest[0] || mv.to[1] !== dest[1]) return false;
    if (disFile && mv.from[1] !== disFile.charCodeAt(0) - 97) return false;
    if (disRank && mv.from[0] !== RANKS - Number(disRank)) return false;
    if (promo && !mv.promotion) return false;
    return true;
  });
  if (legal.length === 0) throw new Error(`Move ${idx} "${tok}" is not legal in this position.`);
  if (!piece && !disFile && legal.length > 1) {
    const pushes = legal.filter((mv) => !mv.captured);
    if (pushes.length >= 1) return pushes.map((mv) => ({ move: mv, promoType: promo || 'Q' }));
  }
  return legal.map((mv) => ({ move: mv, promoType: promo || 'Q' }));
}

// Parse a full game (PGN or bare SAN list) into a stored move list, following
// whichever line of play applies the whole notation legally. The branch budget
// bounds pathological notation to a quick, clear error.
export function parseGameNotation(text) {
  const tokens = tokenize(text);
  const stack = [{ state: initialState(), i: 0, moves: [] }];
  let bestErr = null;
  let bestErrIdx = -1;
  let attempts = 0;
  while (stack.length) {
    if (++attempts > 500) break;
    const node = stack.pop();
    if (node.i >= tokens.length) return node.moves;
    let nexts;
    try {
      nexts = candidatesFor(node.state, tokens[node.i], node.i + 1);
    } catch (e) {
      if (node.i > bestErrIdx) {
        bestErrIdx = node.i;
        bestErr = e;
      }
      continue;
    }
    for (const { move, promoType } of nexts) {
      const stored = serializeMove(move, promoType);
      stack.push({
        state: makeMove(node.state, stored, promoType),
        i: node.i + 1,
        moves: [...node.moves, stored],
      });
    }
  }
  throw bestErr || new Error('Could not apply this notation to a legal game.');
}