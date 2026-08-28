// Seven traditional opening repertoires adapted to the 10×9 Truth Chess board.
// Each entry is a fixed move list in play order (White, Black, White, Black...).
// The AI-vs-AI engine plays these scripted moves for the opening, then hands
// control to the search-based engine once the book is exhausted or a scripted
// move becomes illegal.
//
// Coordinates are [row, file] on the 9-row × 10-file board:
//   White back rank = row 8, White pawns = row 7, Black pawns = row 1, Black back rank = row 0.
//   Files 0..9 = a..j.  King on file 5, Queen on file 4.

export const OPENINGS = [
  {
    name: "King's Pawn Game",
    moves: [
      { from: [7, 5], to: [5, 5], color: 'w' },
      { from: [1, 5], to: [3, 5], color: 'b' },
      { from: [8, 8], to: [6, 7], color: 'w' },
      { from: [0, 8], to: [2, 7], color: 'b' },
    ],
  },
  {
    name: "Queen's Pawn Game",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [0, 1], to: [2, 2], color: 'b' },
    ],
  },
  {
    name: 'English Opening',
    moves: [
      { from: [7, 2], to: [5, 2], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 2], to: [3, 2], color: 'b' },
    ],
  },
  {
    name: "Bird's Opening",
    moves: [
      { from: [7, 6], to: [5, 6], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
    ],
  },
  {
    name: 'Réti Opening',
    moves: [
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [0, 8], to: [2, 7], color: 'b' },
    ],
  },
  {
    name: 'Sokolsky Opening',
    moves: [
      { from: [7, 1], to: [5, 1], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 1], to: [3, 1], color: 'b' },
    ],
  },
  {
    name: 'Hungarian Opening',
    moves: [
      { from: [7, 7], to: [5, 7], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 7], to: [3, 7], color: 'b' },
    ],
  },
];

export function randomOpening() {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

// Returns the scripted legal move for the current turn at the given book index,
// or null when the book is exhausted / the entry's color doesn't match / the
// scripted move isn't legal in the current position.
export function bookMove(book, idx, legalMoves, turn) {
  if (!book || idx >= book.moves.length) return null;
  const entry = book.moves[idx];
  if (entry.color !== turn) return null;
  return (
    legalMoves.find(
      (m) =>
        m.from[0] === entry.from[0] &&
        m.from[1] === entry.from[1] &&
        m.to[0] === entry.to[0] &&
        m.to[1] === entry.to[1]
    ) || null
  );
}