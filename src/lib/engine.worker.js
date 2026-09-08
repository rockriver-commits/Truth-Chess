// Pondering engine worker. Runs the chess search off the main thread so the
// UI stays perfectly responsive while the computer "thinks" — including the
// background pondering waves that keep deepening the search while the human
// player is still deciding their move.
import { bestMove } from './chessAI';
import { setEngineOverrides } from './aiLearning';

// One ponder wave's search budget. Waves are short so a queued real search
// (the human just moved) starts almost immediately; the shared transposition
// table (ctx.keepTT) makes successive waves progressively deeper.
const WAVE_MS = 1200;
const WAVE_MAX_BONUS = 8; // max extra plies beyond the level's depth cap

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'overrides') {
    // Inject the main thread's learned knowledge (mate book, position memory,
    // tuned weights, aggression) — a worker has no localStorage or server.
    setEngineOverrides(msg.data || {});
    return;
  }
  if (msg.type === 'ponder') {
    try {
      const { state, color, difficulty, wave } = msg;
      // Ponder on the "null move": search the current position as if it were
      // the computer's turn. The tree covers the computer's candidate moves
      // and the human's replies, so the transposition table is warm for the
      // real reply search once the human actually moves.
      const ponderState = { ...state, turn: color, ep: null };
      bestMove(ponderState, color, difficulty, false, {
        keepTT: true,
        timeMs: WAVE_MS,
        depthBonus: Math.min(wave || 0, WAVE_MAX_BONUS),
      });
    } catch {
      // a failed ponder wave is harmless — the next wave simply retries
    }
    return;
  }
  if (msg.type === 'search') {
    const { id, state, color, difficulty, ctx } = msg;
    let move = null;
    try {
      move = bestMove(state, color, difficulty, false, { ...(ctx || {}), keepTT: true });
    } catch {
      move = null;
    }
    self.postMessage({ type: 'move', id, move });
  }
};