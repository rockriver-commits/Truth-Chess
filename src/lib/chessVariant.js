// Chancellor Chess — a 9x8 chess variant.
// An extra piece, the Truth (T), sits between the Queen and King on the back rank,
// with a pawn in front of it. Truth moves like a King (one square in any direction),
// can only capture the opposing King, and cannot be captured by any piece.

export const FILES = 9;
export const RANKS = 8;

const BACK = ['R', 'N', 'B', 'Q', 'T', 'K', 'B', 'N', 'R'];

export function initialBoard() {
  const board = Array.from({ length: RANKS }, () => Array(FILES).fill(null));
  for (let f = 0; f < FILES; f++) {
    board[0][f] = { type: BACK[f], color: 'b' };
    board[1][f] = { type: 'P', color: 'b' };
    board[6][f] = { type: 'P', color: 'w' };
    board[7][f] = { type: BACK[f], color: 'w' };
  }
  return board;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((c) => (c ? { ...c } : null)));
}

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KNIGHT_OFFSETS = [
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
];
const KING_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function inBounds(r, f) {
  return r >= 0 && r < RANKS && f >= 0 && f < FILES;
}

function pieceMoves(board, r, f) {
  const piece = board[r][f];
  if (!piece) return [];
  const moves = [];
  const { type, color } = piece;
  const add = (tr, tf, extra = {}) => moves.push({ from: [r, f], to: [tr, tf], piece, ...extra });

  const slide = (dirs) => {
    for (const [dr, df] of dirs) {
      let tr = r + dr;
      let tf = f + df;
      while (inBounds(tr, tf)) {
        const t = board[tr][tf];
        if (!t) {
          add(tr, tf);
        } else if (t.color === color || t.type === 'T') {
          break; // blocked by own piece or the uncapturable Truth
        } else {
          add(tr, tf, { captured: t });
          break;
        }
        tr += dr;
        tf += df;
      }
    }
  };

  const jumps = (offsets) => {
    for (const [dr, df] of offsets) {
      const tr = r + dr;
      const tf = f + df;
      if (!inBounds(tr, tf)) continue;
      const t = board[tr][tf];
      if (!t) add(tr, tf);
      else if (t.color !== color && t.type !== 'T') add(tr, tf, { captured: t });
    }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 6 : 1;
      const promoRank = color === 'w' ? 0 : 7;
      const tr = r + dir;
      if (inBounds(tr, f) && !board[tr][f]) {
        if (tr === promoRank) add(tr, f, { promotion: true });
        else add(tr, f);
        if (r === startRank) {
          const tr2 = r + 2 * dir;
          if (inBounds(tr2, f) && !board[tr2][f]) add(tr2, f);
        }
      }
      for (const df of [-1, 1]) {
        const tf = f + df;
        if (inBounds(tr, tf)) {
          const t = board[tr][tf];
          if (t && t.color !== color && t.type !== 'T') {
            if (tr === promoRank) add(tr, tf, { captured: t, promotion: true });
            else add(tr, tf, { captured: t });
          }
        }
      }
      break;
    }
    case 'N':
      jumps(KNIGHT_OFFSETS);
      break;
    case 'B':
      slide(BISHOP_DIRS);
      break;
    case 'R':
      slide(ROOK_DIRS);
      break;
    case 'Q':
      slide(ROOK_DIRS);
      slide(BISHOP_DIRS);
      break;
    case 'T': {
      for (const [dr, df] of KING_OFFSETS) {
        const tr = r + dr;
        const tf = f + df;
        if (!inBounds(tr, tf)) continue;
        const t = board[tr][tf];
        if (!t) add(tr, tf);
        else if (t.color !== color && t.type === 'K') add(tr, tf, { captured: t });
      }
      break;
    }
    case 'K':
      jumps(KING_OFFSETS);
      break;
    default:
      break;
  }
  return moves;
}

export function isSquareAttacked(board, r, f, byColor) {
  // Pawn attacks: white pawn at (r+1, f±1) attacks (r,f); black pawn at (r-1, f±1).
  const pr = byColor === 'w' ? r + 1 : r - 1;
  for (const pf of [f - 1, f + 1]) {
    if (inBounds(pr, pf)) {
      const t = board[pr][pf];
      if (t && t.color === byColor && t.type === 'P') return true;
    }
  }
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const tr = r + dr;
    const tf = f + df;
    if (inBounds(tr, tf)) {
      const t = board[tr][tf];
      if (t && t.color === byColor && t.type === 'N') return true;
    }
  }
  for (const [dr, df] of KING_OFFSETS) {
    const tr = r + dr;
    const tf = f + df;
    if (inBounds(tr, tf)) {
      const t = board[tr][tf];
      if (t && t.color === byColor && (t.type === 'K' || t.type === 'T')) return true;
    }
  }
  for (const [dr, df] of ROOK_DIRS) {
    let tr = r + dr;
    let tf = f + df;
    while (inBounds(tr, tf)) {
      const t = board[tr][tf];
      if (t) {
        if (t.color === byColor && (t.type === 'R' || t.type === 'Q')) return true;
        break;
      }
      tr += dr;
      tf += df;
    }
  }
  for (const [dr, df] of BISHOP_DIRS) {
    let tr = r + dr;
    let tf = f + df;
    while (inBounds(tr, tf)) {
      const t = board[tr][tf];
      if (t) {
        if (t.color === byColor && (t.type === 'B' || t.type === 'Q')) return true;
        break;
      }
      tr += dr;
      tf += df;
    }
  }
  return false;
}

export function findKing(board, color) {
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (p && p.type === 'K' && p.color === color) return [r, f];
    }
  }
  return null;
}

export function inCheck(board, color) {
  const k = findKing(board, color);
  if (!k) return false;
  return isSquareAttacked(board, k[0], k[1], color === 'w' ? 'b' : 'w');
}

function applyMove(board, move, promoType = 'Q') {
  const nb = cloneBoard(board);
  const [fr, ff] = move.from;
  const [tr, tf] = move.to;
  const piece = nb[fr][ff];
  nb[fr][ff] = null;
  nb[tr][tf] = move.promotion ? { type: promoType, color: piece.color } : piece;
  return nb;
}

export function legalMovesFor(board, r, f, promoType = 'Q') {
  const piece = board[r][f];
  if (!piece) return [];
  return pieceMoves(board, r, f).filter((m) => {
    const nb = applyMove(board, m, promoType);
    return !inCheck(nb, piece.color);
  });
}

export function allLegalMoves(board, color, promoType = 'Q') {
  const moves = [];
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = board[r][f];
      if (p && p.color === color) moves.push(...legalMovesFor(board, r, f, promoType));
    }
  }
  return moves;
}

export function gameStatus(board, turn) {
  const moves = allLegalMoves(board, turn);
  const checked = inCheck(board, turn);
  if (moves.length === 0) return checked ? 'checkmate' : 'stalemate';
  return checked ? 'check' : 'playing';
}

export function makeMove(board, move, promoType = 'Q') {
  return applyMove(board, move, promoType);
}