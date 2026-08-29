// Truth Chess — a 10x9 chess variant.
// Back rank: R N B T Q K T B N R. Truth (T) moves like a Queen. It captures only the
// opposing Truth, and can be captured only by the opposing King or an opposing Truth.
// Although it otherwise does not capture, it controls the squares it slides to, so it
// can deliver check & checkmate.
// New rule: a side's Truth is locked — it cannot be moved until that side has put the
// opponent's king in check at least once. The lock is permanent once broken.
// Castling and en passant are supported. State carries castling rights + ep target +
// Truth-unlock flags.
// White occupies ranks 1-2 (rows 8-7), Black occupies ranks 8-9 (rows 1-0);
// ranks 3-7 (rows 6-2) are an empty buffer — armies start five ranks apart.

export const FILES = 10;
export const RANKS = 9;

const BACK = ['R', 'N', 'B', 'T', 'Q', 'K', 'T', 'B', 'N', 'R'];

export function initialBoard() {
  const board = Array.from({ length: RANKS }, () => Array(FILES).fill(null));
  for (let f = 0; f < FILES; f++) {
    board[0][f] = { type: BACK[f], color: 'b' };
    board[1][f] = { type: 'P', color: 'b' };
    board[7][f] = { type: 'P', color: 'w' };
    board[8][f] = { type: BACK[f], color: 'w' };
  }
  return board;
}

export function initialState() {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { w: { K: true, Q: true }, b: { K: true, Q: true } },
    ep: null,
    halfmove: 0,
    truthUnlocked: { w: false, b: false },
  };
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

// Castling definitions for the 10-wide board. King starts on file 5.
const CASTLE = {
  w: {
    K: { kingFrom: [8, 5], kingTo: [8, 7], rookFrom: [8, 9], rookTo: [8, 6], empty: [[8, 6], [8, 7], [8, 8]], pass: [[8, 5], [8, 6], [8, 7]] },
    Q: { kingFrom: [8, 5], kingTo: [8, 3], rookFrom: [8, 0], rookTo: [8, 4], empty: [[8, 1], [8, 2], [8, 3], [8, 4]], pass: [[8, 5], [8, 4], [8, 3]] },
  },
  b: {
    K: { kingFrom: [0, 5], kingTo: [0, 7], rookFrom: [0, 9], rookTo: [0, 6], empty: [[0, 6], [0, 7], [0, 8]], pass: [[0, 5], [0, 6], [0, 7]] },
    Q: { kingFrom: [0, 5], kingTo: [0, 3], rookFrom: [0, 0], rookTo: [0, 4], empty: [[0, 1], [0, 2], [0, 3], [0, 4]], pass: [[0, 5], [0, 4], [0, 3]] },
  },
};

function inBounds(r, f) {
  return r >= 0 && r < RANKS && f >= 0 && f < FILES;
}

function pieceMoves(state, r, f) {
  const board = state.board;
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
        if (!t) add(tr, tf);
        else if (t.color === color || t.type === 'T') break; // Truth is capturable only by a King or an opposing Truth, never by B/R/Q
        else {
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

  // King may capture any enemy piece, including the enemy Truth.
  const kingJumps = (offsets) => {
    for (const [dr, df] of offsets) {
      const tr = r + dr;
      const tf = f + df;
      if (!inBounds(tr, tf)) continue;
      const t = board[tr][tf];
      if (!t) add(tr, tf);
      else if (t.color !== color) add(tr, tf, { captured: t });
    }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 7 : 1;
      const promoRank = color === 'w' ? 0 : 8;
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
        if (!inBounds(tr, tf)) continue;
        const t = board[tr][tf];
        if (t && t.color !== color && t.type !== 'T') {
          if (tr === promoRank) add(tr, tf, { captured: t, promotion: true });
          else add(tr, tf, { captured: t });
        } else if (!t && state.ep && state.ep[0] === tr && state.ep[1] === tf) {
          const cap = board[r][tf];
          if (cap && cap.color !== color && cap.type === 'P') {
            add(tr, tf, { ep: true, captured: cap, capturedAt: [r, tf] });
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
      const enemy = color === 'w' ? 'b' : 'w';
      for (const dirs of [ROOK_DIRS, BISHOP_DIRS]) {
        for (const [dr, df] of dirs) {
          let tr = r + dr;
          let tf = f + df;
          while (inBounds(tr, tf)) {
            const t = board[tr][tf];
            if (!t) add(tr, tf);
            else {
              // Truth captures only the opposing Truth; every other piece blocks it.
              if (t.color === enemy && t.type === 'T') add(tr, tf, { captured: t });
              break;
            }
            tr += dr;
            tf += df;
          }
        }
      }
      break;
    }
    case 'K': {
      kingJumps(KING_OFFSETS);
      const rights = state.castling[color];
      const enemy = color === 'w' ? 'b' : 'w';
      const kingHere = board[CASTLE[color].K.kingFrom[0]][CASTLE[color].K.kingFrom[1]];
      if (!kingHere || kingHere.type !== 'K' || kingHere.color !== color) break;
      const kingRemoved = cloneBoard(board);
      kingRemoved[CASTLE[color].K.kingFrom[0]][CASTLE[color].K.kingFrom[1]] = null;
      for (const side of ['K', 'Q']) {
        if (!rights[side]) continue;
        const c = CASTLE[color][side];
        const rook = board[c.rookFrom[0]][c.rookFrom[1]];
        if (!rook || rook.type !== 'R' || rook.color !== color) continue;
        let ok = true;
        for (const [er, ef] of c.empty) if (board[er][ef]) { ok = false; break; }
        if (!ok) continue;
        for (const [pr, pf] of c.pass) if (isSquareAttacked(kingRemoved, pr, pf, enemy)) { ok = false; break; }
        if (!ok) continue;
        add(c.kingTo[0], c.kingTo[1], { castle: side });
      }
      break;
    }
    default:
      break;
  }
  return moves;
}

export function isSquareAttacked(board, r, f, byColor) {
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
      if (t && t.color === byColor && t.type === 'K') return true;
    }
  }
  // Truth (T) moves like a Queen — it slides along rook and bishop rays and,
  // although it never captures, it controls those squares and can therefore
  // deliver check (and checkmate) to the opposing King.
  for (const [dr, df] of ROOK_DIRS) {
    let tr = r + dr;
    let tf = f + df;
    while (inBounds(tr, tf)) {
      const t = board[tr][tf];
      if (t) {
        if (t.color === byColor && (t.type === 'R' || t.type === 'Q' || t.type === 'T')) return true;
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
        if (t.color === byColor && (t.type === 'B' || t.type === 'Q' || t.type === 'T')) return true;
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

// Stable position key for repetition detection (board + turn + castling + ep).
export function positionKey(state) {
  let s = state.turn + '|';
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = state.board[r][f];
      s += p ? p.color + p.type : '.';
    }
    s += '|';
  }
  s += (state.castling.w.K ? 'K' : '') + (state.castling.w.Q ? 'Q' : '')
    + (state.castling.b.K ? 'k' : '') + (state.castling.b.Q ? 'q' : '') + '|';
  s += state.ep ? state.ep[0] + ',' + state.ep[1] : '-';
  s += '|' + (state.truthUnlocked ? (state.truthUnlocked.w ? 'W' : '') + (state.truthUnlocked.b ? 'B' : '') : '');
  return s;
}

export function inCheck(state, color) {
  const k = findKing(state.board, color);
  if (!k) return false;
  return isSquareAttacked(state.board, k[0], k[1], color === 'w' ? 'b' : 'w');
}

function applyMove(state, move, promoType = 'Q') {
  const nb = cloneBoard(state.board);
  const [fr, ff] = move.from;
  const [tr, tf] = move.to;
  const piece = nb[fr][ff];
  nb[fr][ff] = null;
  nb[tr][tf] = move.promotion ? { type: promoType, color: piece.color } : piece;

  if (move.castle) {
    const c = CASTLE[piece.color][move.castle];
    const rook = nb[c.rookFrom[0]][c.rookFrom[1]];
    nb[c.rookFrom[0]][c.rookFrom[1]] = null;
    nb[c.rookTo[0]][c.rookTo[1]] = rook;
  }
  if (move.ep) {
    nb[move.capturedAt[0]][move.capturedAt[1]] = null;
  }

  const castling = {
    w: { ...state.castling.w },
    b: { ...state.castling.b },
  };
  if (piece.type === 'K') {
    castling[piece.color].K = false;
    castling[piece.color].Q = false;
  }
  if (piece.type === 'R') {
    for (const side of ['K', 'Q']) {
      const c = CASTLE[piece.color][side];
      if (fr === c.rookFrom[0] && ff === c.rookFrom[1]) castling[piece.color][side] = false;
    }
  }
  if (move.captured && move.captured.type === 'R') {
    const opp = piece.color === 'w' ? 'b' : 'w';
    for (const side of ['K', 'Q']) {
      const c = CASTLE[opp][side];
      if (tr === c.rookFrom[0] && tf === c.rookFrom[1]) castling[opp][side] = false;
    }
  }

  let ep = null;
  if (piece.type === 'P' && Math.abs(tr - fr) === 2) {
    ep = [(tr + fr) / 2, ff];
  }

  const resetHalf = piece.type === 'P' || !!move.captured;
  const halfmove = resetHalf ? 0 : (state.halfmove || 0) + 1;

  // Carry over the Truth-unlock flags. The actual unlock (when a side delivers
  // a check) is resolved in makeMove, so the cheap probe calls made inside
  // legalMovesFor don't each re-run check detection.
  const truthUnlocked = { ...(state.truthUnlocked || { w: false, b: false }) };

  return { board: nb, turn: piece.color === 'w' ? 'b' : 'w', castling, ep, halfmove, truthUnlocked };
}

export function legalMovesFor(state, r, f) {
  const piece = state.board[r][f];
  if (!piece) return [];
  // The Truth piece is locked: a side may not move its Truth until it has put
  // the opponent's king in check at least once in the game. (A locked Truth
  // still controls its squares and can deliver check from where it stands.)
  if (piece.type === 'T' && !(state.truthUnlocked && state.truthUnlocked[piece.color])) {
    return [];
  }
  return pieceMoves(state, r, f).filter((m) => {
    const ns = applyMove(state, m, 'Q');
    return !inCheck(ns, piece.color);
  });
}

export function allLegalMoves(state, color) {
  const moves = [];
  for (let r = 0; r < RANKS; r++) {
    for (let f = 0; f < FILES; f++) {
      const p = state.board[r][f];
      if (p && p.color === color) moves.push(...legalMovesFor(state, r, f));
    }
  }
  return moves;
}

export function gameStatus(state) {
  const moves = allLegalMoves(state, state.turn);
  const checked = inCheck(state, state.turn);
  if (moves.length === 0) return checked ? 'checkmate' : 'stalemate';
  if ((state.halfmove || 0) >= 100) return 'fifty_move';
  return checked ? 'check' : 'playing';
}

export function makeMove(state, move, promoType = 'Q') {
  const ns = applyMove(state, move, promoType);
  // Unlock the mover's Truth piece if this move puts the opponent's king in
  // check. Once unlocked, it stays unlocked for the rest of the game.
  const mover = state.turn;
  const opp = mover === 'w' ? 'b' : 'w';
  if (inCheck(ns, opp)) ns.truthUnlocked = { ...ns.truthUnlocked, [mover]: true };
  return ns;
}