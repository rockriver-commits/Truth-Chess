// Main-thread client for the pondering engine worker (vs Computer mode).
// Sends positions to the worker, hands back the chosen move, and drives the
// background pondering waves. Returns null if Web Workers are unavailable —
// callers fall back to the in-page search.
import { getMateBookSnapshot, getLearnedSnapshot, loadEvalWeights, loadAggression } from './aiLearning';

export function createEngineClient() {
  let worker;
  try {
    worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }

  let seq = 0;
  let overridesSent = false;
  const pending = new Map();

  const ensureOverrides = () => {
    if (overridesSent) return;
    overridesSent = true;
    try {
      worker.postMessage({
        type: 'overrides',
        data: {
          book: getMateBookSnapshot(),
          learned: getLearnedSnapshot(),
          weights: loadEvalWeights(),
          aggression: loadAggression(),
        },
      });
    } catch {
      // without overrides the worker still plays, just without learned data
    }
  };

  worker.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type !== 'move') return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg.move);
  };
  worker.onerror = () => {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error('engine worker failed'));
    }
    pending.clear();
  };

  return {
    // Ask the worker for the computer's move. Resolves with the move (or null).
    search(state, color, difficulty, ctx, timeoutMs = 10000) {
      ensureOverrides();
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('engine worker timeout'));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ type: 'search', id, state, color, difficulty, ctx: ctx || null });
      });
    },
    // One background thinking wave while the human is deciding. Fire-and-forget.
    ponder(state, color, difficulty, wave) {
      ensureOverrides();
      worker.postMessage({ type: 'ponder', state, color, difficulty, wave });
    },
    dispose() {
      worker.terminate();
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('engine worker disposed'));
      }
      pending.clear();
    },
  };
}