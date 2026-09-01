import React from 'react';
import { Dna, Play, Square, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GAME_COUNTS = [10, 25, 50, 100];
const DEPTHS = [5, 6, 7, 8];

// Engine Training card: pick a game count and search depth, then run
// AI-vs-AI self-play at a fast cadence. Each finished game writes mating lines,
// position→move→outcome rows, and tuned eval weights to the shared server
// entities, so every device's engine gets stronger — pure search, no credits.
export default function EngineTraining({
  active,
  target,
  depth,
  gamesCompleted,
  onStart,
  onStop,
  onSelectTarget,
  onSelectDepth,
}) {
  const pct = target ? Math.min(100, Math.round((gamesCompleted / target) * 100)) : 0;
  const complete = !active && gamesCompleted > 0 && gamesCompleted >= target;

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-fuchsia-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Dna className="w-5 h-5 text-fuchsia-600" />
        <h2 className="text-sm font-semibold text-stone-800">Engine Training</h2>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Games</p>
          <div className="flex gap-1.5">
            {GAME_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={active}
                onClick={() => onSelectTarget(n)}
                className={`flex-1 h-8 text-xs rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  target === n
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white/90 text-stone-600 border-stone-300 hover:bg-fuchsia-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Search depth</p>
          <div className="flex gap-1.5">
            {DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={active}
                onClick={() => onSelectDepth(d)}
                className={`flex-1 h-8 text-xs rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  depth === d
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white/90 text-stone-600 border-stone-300 hover:bg-fuchsia-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span>Progress</span>
              <span className="font-mono font-semibold text-fuchsia-700">{gamesCompleted} / {target}</span>
            </div>
            <div className="h-2 rounded-full bg-fuchsia-100 overflow-hidden">
              <div className="h-full bg-fuchsia-600 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <Button onClick={onStop} variant="outline" className="w-full h-9 text-sm gap-2 border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50">
              <Square className="w-4 h-4" /> Stop training
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <Button onClick={onStart} className="w-full h-9 text-sm gap-2 bg-fuchsia-600 hover:bg-fuchsia-700">
              <Play className="w-4 h-4" /> Start training
            </Button>
            {gamesCompleted > 0 && (
              <p className="flex items-center justify-center gap-1 text-[0.7rem] text-stone-500">
                {complete ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                Last run: {gamesCompleted}/{target} {complete ? '· complete' : '· stopped'}
              </p>
            )}
          </div>
        )}

        <p className="text-[0.65rem] text-stone-400 leading-relaxed pt-1">
          Runs AI-vs-AI self-play at ~120ms per move. Each game writes mating lines, positions, and tuned eval weights to the shared engine memory — every device's engine gets stronger. No integration credits spent.
        </p>
      </div>
    </div>
  );
}