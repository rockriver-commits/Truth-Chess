// Lightweight chess sound effects via the Web Audio API (no asset files).
// Returns a single play(kind) function; no-op when disabled.
import { useRef, useCallback } from 'react';

export function useChessSounds(enabled) {
  const ctxRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    return ctxRef.current;
  };

  const tone = useCallback((freq, dur, type = 'sine', gain = 0.07) => {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }, []);

  const play = useCallback((kind) => {
    if (!enabledRef.current) return;
    if (kind === 'move') tone(440, 0.08, 'sine', 0.05);
    else if (kind === 'capture') tone(300, 0.1, 'square', 0.06);
    else if (kind === 'check') tone(760, 0.18, 'triangle', 0.07);
    else if (kind === 'mate' || kind === 'stale') tone(260, 0.24, 'sine', 0.07);
  }, [tone]);

  return play;
}