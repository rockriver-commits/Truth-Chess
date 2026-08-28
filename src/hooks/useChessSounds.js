// Lightweight chess sound effects via the Web Audio API (no asset files).
// Returns a single play(kind) function; no-op when disabled.
// Browsers block audio until a user gesture, so we eagerly resume the
// AudioContext on the first pointerdown/keydown.
import { useRef, useCallback, useEffect } from 'react';

export function useChessSounds(enabled) {
  const ctxRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    return ctxRef.current;
  }, []);

  // Resume the AudioContext on the first user interaction (autoplay policy).
  useEffect(() => {
    const resumeOnGesture = () => {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', resumeOnGesture, { once: true });
    window.addEventListener('keydown', resumeOnGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
  }, [ensure]);

  const play = useCallback(async (kind) => {
    if (!enabledRef.current) return;
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    const params = {
      move: { freq: 420, dur: 0.09, type: 'sine', gain: 0.16 },
      capture: { freq: 300, dur: 0.12, type: 'square', gain: 0.14 },
      check: { freq: 760, dur: 0.18, type: 'triangle', gain: 0.16 },
      mate: { freq: 240, dur: 0.3, type: 'sine', gain: 0.18 },
      stale: { freq: 240, dur: 0.3, type: 'sine', gain: 0.18 },
    }[kind];
    if (!params) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = params.type;
    o.frequency.value = params.freq;
    const t = ctx.currentTime + 0.01;
    g.gain.setValueAtTime(params.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + params.dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + params.dur);
  }, [ensure]);

  return play;
}