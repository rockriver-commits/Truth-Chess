// Refresh persistence for local games (2 Players, vs Computer, AI vs AI).
// The full serialized move list plus clocks and settings is saved to
// localStorage as the game is played; on load the game is replayed move by
// move and restored exactly where it left off, so a page refresh or an
// accidental back-button resumes the game instead of restarting it. Online
// games are never saved here — they already live on the server.
const KEY = 'tc-saved-game';
const VERSION = 1;
const LOCAL_MODES = ['local', 'computer', 'cvc', 'cvc_turbo'];

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...data }));
  } catch {
    // storage full or unavailable — the game just won't survive a refresh
  }
}

export function loadSavedGame() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || raw.v !== VERSION) return null;
    if (!LOCAL_MODES.includes(raw.mode)) return null;
    if (!Array.isArray(raw.moves) || raw.moves.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}