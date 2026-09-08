import React, { useRef, useState } from 'react';
import { Swords, Play, Square, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runTournament } from '@/lib/tournament';

const GAME_COUNTS = [4, 8, 16];
const LEVELS = [2, 3, 4];

// Strength Validation card: plays a match between the full learned engine
// (mate book, learned positions, tuned eval weights, adaptive aggression) and
// a baseline engine with every learned system switched off. Colors alternate
// each game and the score is reported from the learned engine's perspective —
// a running measure of exactly what the training systems add. Pure search, no
// integration credits.
export default function TournamentPanel() {
  const [running, setRunning] = useState(false);
  const [games, setGames] = useState(4);
  const [level, setLevel] = useState(3);
  const [tally, setTally] = useState(null); // { wins, losses, draws, played }
  const [status, setStatus] = useState('');
  const [log, setLog] = useState([]);
  const [finished, setFinished] = useState(false);
  const stopRef = useRef(false);

  async function start() {
    setRunning(true);
    setFinished(false);
    stopRef.current = false;
    setTally({ wins: 0, losses: 0, draws: 0, played: 0 });
    setLog([]);
    setStatus('Starting…');
    const final = await runTournament({
      games,
      difficulty: level,
      shouldStop: () => stopRef.current,
      onProgress: (g, ply) => setStatus(`Game ${g} of ${games} · move ${ply}`),
      onGameDone: (g, res) => {
        setTally((t) => {
          const n = { ...t, played: t.played + 1 };
          if (res.outcome === 'win') n.wins++;
          else if (res.outcome === 'loss') n.losses++;
          else n.draws++;
          return n;
        });
        setLog((l) => [
          `${g}. Learned as ${res.learnedIsWhite ? 'White' : 'Black'} — ${res.outcome} (${res.reason}, ${res.plies} plies)`,
          ...l,
        ].slice(0, 12));
        setStatus(`Game ${g} of ${games} finished`);
      },
    });
    setTally(final);
    setRunning(false);
    setFinished(true);
    setStatus('');
  }

  function stop() {
    stopRef.current = true;
    setStatus('Stopping…');
  }

  const score = tally ? tally.wins + 0.5 * tally.draws : 0;
  const pct = tally && tally.played ? Math.round((score / tally.played) * 100) : 0;
  const verdict =
    tally && tally.played
      ? pct >= 58
        ? 'Learned engine is measurably stronger'
        : pct <= 42
        ? 'No measured gain yet — run more training games'
        : 'Comparable — a larger sample is needed'
      : null;

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-indigo-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Swords className="w-5 h-5 text-indigo-600" />
        <h2 className="text-sm font-semibold text-stone-800">Strength Validation</h2>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Games</p>
          <div className="flex gap-1.5">
            {GAME_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={running}
                onClick={() => setGames(n)}
                className={`flex-1 h-8 text-xs rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  games === n
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white/90 text-stone-600 border-stone-300 hover:bg-indigo-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Engine level</p>
          <div className="flex gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                disabled={running}
                onClick={() => setLevel(l)}
                className={`flex-1 h-8 text-xs rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  level === l
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white/90 text-stone-600 border-stone-300 hover:bg-indigo-50'
                }`}
              >
                Level {l}
              </button>
            ))}
          </div>
        </div>

        {running ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-stone-600 font-mono">{status}</p>
            {tally && (
              <p className="text-sm font-semibold text-stone-800">
                Learned {tally.wins}W · {tally.draws}D · {tally.losses}L
                <span className="text-stone-400 font-normal"> ({tally.played} played)</span>
              </p>
            )}
            <Button onClick={stop} variant="outline" className="w-full h-9 text-sm gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <Square className="w-4 h-4" /> Stop match
            </Button>
          </div>
        ) : (
          <Button onClick={start} className="w-full h-9 text-sm gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Play className="w-4 h-4" /> Start match
          </Button>
        )}

        {finished && tally && tally.played > 0 && (
          <div className="rounded-xl bg-indigo-50 ring-1 ring-indigo-200 p-3 space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800">
              <Check className="w-4 h-4" /> {verdict}
            </p>
            <p className="text-xs text-stone-600">
              Score {score} / {tally.played} ({pct}%) — {tally.wins}W · {tally.draws}D · {tally.losses}L vs baseline
            </p>
          </div>
        )}

        {log.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-xl bg-stone-50 ring-1 ring-stone-200 p-2.5 space-y-1">
            {log.map((line, i) => (
              <p key={i} className="text-[0.65rem] font-mono text-stone-500 leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        <p className="text-[0.65rem] text-stone-400 leading-relaxed pt-1">
          Plays the learned engine against a knowledge-free baseline of the same search, alternating colors.
          The score measures exactly what the mate book, position memory, and tuned weights add.
        </p>
      </div>
    </div>
  );
}