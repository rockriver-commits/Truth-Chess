// Strength-validation tournament for the Truth Chess engine.
// Plays a match between two configurations of the same search: the full
// learned engine (mate book + learned position memory + tuned eval weights +
// adaptive aggression) and a baseline engine with every learned system
// disabled (ctx.baseline in chessAI). Colors alternate each game so neither
// side keeps the first-move advantage; the score is reported from the learned
// engine's perspective. Tournament games deliberately do NOT feed back into
// the learned systems — validation must stay independent of training.
import { initialState, makeMove, gameStatus, positionKey } from './chessVariant';
import { bestMove } from './chessAI';

const PLY_CAP = 260; // adjudicate as a draw beyond this

// Play one tournament game. `learnedIsWhite` fixes the color assignment.
// hooks: { onProgress(plies), shouldStop() } — shouldStop is checked every ply
// so a long game can be aborted mid-run without waiting for the game to end.
// Returns { outcome: 'win'|'loss'|'draw'|'aborted', plies, reason } with the
// outcome from the LEARNED engine's point of view.
export async function playTournamentGame(learnedIsWhite, difficulty, hooks = {}) {
  const { onProgress, shouldStop } = hooks;
  let state = initialState();
  const positionKeys = [positionKey(state)];
  const seen = new Map([[positionKeys[0], 1]]);
  let ply = 0;
  for (; ply < PLY_CAP; ply++) {
    if (shouldStop && shouldStop()) return { outcome: 'aborted', plies: ply, reason: 'stopped' };
    const st0 = gameStatus(state);
    if (st0 === 'checkmate') return finish(state, 'checkmate', learnedIsWhite, ply);
    if (st0 === 'stalemate' || st0 === 'fifty_move') return finish(state, st0, learnedIsWhite, ply);
    // The learned engine uses the full learned stack; the baseline engine
    // searches with every learned system switched off.
    const learnedTurn = (state.turn === 'w') === learnedIsWhite;
    const move = bestMove(state, state.turn, difficulty, false, {
      baseline: !learnedTurn,
      positionKeys,
    });
    if (!move) return finish(state, 'no legal moves', learnedIsWhite, ply);
    state = makeMove(state, move, 'Q');
    const k = positionKey(state);
    positionKeys.push(k);
    const rep = (seen.get(k) || 0) + 1;
    seen.set(k, rep);
    if (onProgress) onProgress(ply + 1);
    await new Promise((r) => setTimeout(r, 0)); // yield so the UI can paint
    if (rep >= 3) return finish(state, 'threefold', learnedIsWhite, ply + 1);
  }
  return finish(state, 'ply cap', learnedIsWhite, ply);
}

function finish(state, reason, learnedIsWhite, plies) {
  if (reason === 'checkmate') {
    const whiteWon = state.turn === 'b'; // the side to move is mated
    return { outcome: whiteWon === learnedIsWhite ? 'win' : 'loss', plies, reason };
  }
  return { outcome: 'draw', plies, reason };
}

// Run a full match of `games` games at `difficulty`, alternating colors.
// Calls onProgress(gameNumber, plies) during play and onGameDone(gameNumber,
// result) after each game. Returns the final tally from the learned engine's
// perspective: { wins, losses, draws, played }.
export async function runTournament({ games, difficulty, shouldStop, onProgress, onGameDone }) {
  const tally = { wins: 0, losses: 0, draws: 0, played: 0 };
  for (let i = 0; i < games; i++) {
    if (shouldStop && shouldStop()) break;
    const learnedIsWhite = i % 2 === 0;
    const res = await playTournamentGame(learnedIsWhite, difficulty, {
      onProgress: (ply) => onProgress && onProgress(i + 1, ply),
      shouldStop,
    });
    if (res.outcome === 'aborted') break;
    tally.played++;
    if (res.outcome === 'win') tally.wins++;
    else if (res.outcome === 'loss') tally.losses++;
    else tally.draws++;
    if (onGameDone) onGameDone(i + 1, { ...res, learnedIsWhite });
  }
  return tally;
}