// Twenty-three traditional opening repertoires adapted to the 10×9 Truth Chess
// board. Each entry is a fixed move list in play order (White, Black, White,
// Black...). The AI-vs-AI and vs-Computer engines play these scripted moves for
// the opening, then hand control to the search-based engine once the book is
// exhausted or a scripted move becomes illegal in the current position.
//
// Coordinates are [row, file] on the 9-row × 10-file board:
//   White back rank = row 8, White pawns = row 7, Black pawns = row 1, Black back rank = row 0.
//   Files 0..9 = a..j.  King on file 5, Queen on file 4.
//   White knights: [8,1] & [8,8];  Black knights: [0,1] & [0,8].

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
  {
    name: "King's Pawn, Q-Knight",
    moves: [
      { from: [7, 5], to: [5, 5], color: 'w' },
      { from: [1, 5], to: [3, 5], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [0, 1], to: [2, 2], color: 'b' },
    ],
  },
  {
    name: "Queen's Pawn, K-Knight",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [8, 8], to: [6, 7], color: 'w' },
      { from: [0, 8], to: [2, 7], color: 'b' },
    ],
  },
  {
    name: 'Sicilian Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 2], to: [3, 2], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [0, 1], to: [2, 2], color: 'b' },
    ],
  },
  {
    name: 'French Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [2, 4], color: 'b' },
      { from: [7, 3], to: [5, 3], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
    ],
  },
  {
    name: 'Caro-Kann Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 2], to: [2, 2], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
    ],
  },
  {
    name: 'Pirc Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
    ],
  },
  {
    name: 'Modern Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [1, 7], to: [3, 7], color: 'b' },
    ],
  },
  {
    name: 'Scandinavian Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 8], to: [6, 7], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
    ],
  },
  {
    name: "Alekhine's Defense",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [0, 1], to: [2, 2], color: 'b' },
      { from: [8, 8], to: [6, 7], color: 'w' },
      { from: [0, 8], to: [2, 7], color: 'b' },
    ],
  },
  {
    name: "King's Indian Defense",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [7, 5], to: [5, 5], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
    ],
  },
  {
    name: 'Slav Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 2], to: [5, 2], color: 'w' },
      { from: [1, 2], to: [3, 2], color: 'b' },
    ],
  },
  {
    name: "Queen's Gambit",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 3], to: [5, 3], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
    ],
  },
  {
    name: 'Nimzo-Indian Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [0, 1], to: [2, 2], color: 'b' },
    ],
  },
  {
    name: 'Bogo-Indian Defense',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 8], to: [6, 7], color: 'w' },
      { from: [0, 8], to: [2, 7], color: 'b' },
    ],
  },
  {
    name: "Grünfeld Defense",
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 3], to: [3, 3], color: 'b' },
      { from: [8, 1], to: [6, 2], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
    ],
  },
  {
    name: 'Catalan Opening',
    moves: [
      { from: [7, 4], to: [5, 4], color: 'w' },
      { from: [1, 4], to: [3, 4], color: 'b' },
      { from: [7, 6], to: [5, 6], color: 'w' },
      { from: [1, 6], to: [3, 6], color: 'b' },
    ],
  },
];

export function randomOpening() {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

// Returns the scripted legal move for the current turn at the given ply index,
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