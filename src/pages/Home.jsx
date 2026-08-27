import React, { useState, useMemo, useEffect } from 'react';
import ChessBoard from '@/components/ChessBoard';
import {
  initialState,
  legalMovesFor,
  gameStatus,
  makeMove,
} from '@/lib/chessVariant';
import { bestMove, DIFFICULTIES } from '@/lib/chessAI';
import { generateCode, replayGame, serializeMove } from '@/lib/onlineGame';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import OnlinePanel from '@/components/OnlinePanel';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };

export default function Home() {
  const [mode, setMode] = useState('local'); // 'local' | 'computer' | 'online'

  // local / computer
  const [localState, setLocalState] = useState(initialState);
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [localCaptured, setLocalCaptured] = useState({ w: [], b: [] });
  const [localLastMove, setLocalLastMove] = useState(null);
  const [promo, setPromo] = useState(null);
  const [difficulty, setDifficulty] = useState(1);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingAdvance, setPendingAdvance] = useState(false);

  // online
  const [me, setMe] = useState(null);
  const [onlineGame, setOnlineGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [openGames, setOpenGames] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => setMe(null));
  }, []);

  const onlineDerived = useMemo(() => {
    if (mode !== 'online' || !onlineGame) return null;
    return replayGame(onlineGame.moves);
  }, [mode, onlineGame]);

  const myColor = useMemo(() => {
    if (!onlineGame || !me) return null;
    if (onlineGame.white_player_id === me.id) return 'w';
    if (onlineGame.black_player_id === me.id) return 'b';
    return null;
  }, [onlineGame, me]);

  const state = mode === 'online' ? onlineDerived?.state : localState;
  const captured =
    mode === 'online' ? onlineDerived?.captured || { w: [], b: [] } : localCaptured;
  const lastMove = mode === 'online' ? onlineDerived?.lastMove || null : localLastMove;
  const turn = state?.turn;

  const status = useMemo(() => (state ? gameStatus(state) : 'playing'), [state]);
  const gameOver = status === 'checkmate' || status === 'stalemate';

  function handleSquareClick(r, f) {
    if (gameOver || promo || submitting) return;
    if (mode === 'computer' && turn === 'b') return;
    if (mode === 'online') {
      if (!onlineGame || onlineGame.status !== 'active') return;
      if (!myColor || turn !== myColor) return;
    }
    const piece = state.board[r][f];
    if (selected) {
      const move = legalMoves.find((m) => m.to[0] === r && m.to[1] === f);
      if (move) {
        if (move.promotion) {
          setPromo({ move, color: turn });
          return;
        }
        commitMove(move, 'Q');
        return;
      }
      if (piece && piece.color === turn) {
        setSelected([r, f]);
        setLegalMoves(legalMovesFor(state, r, f));
        return;
      }
      setSelected(null);
      setLegalMoves([]);
      return;
    }
    if (piece && piece.color === turn) {
      if (mode === 'online' && piece.color !== myColor) return;
      setSelected([r, f]);
      setLegalMoves(legalMovesFor(state, r, f));
    }
  }

  function commitMove(move, promoType) {
    if (mode === 'online') {
      setSelected(null);
      setLegalMoves([]);
      setPromo(null);
      appendMove(serializeMove(move, promoType));
      return;
    }
    setHistory((h) => [...h, { state: localState, captured: localCaptured, lastMove: localLastMove }]);
    if (move.captured) {
      setLocalCaptured((c) => ({ ...c, [localState.turn]: [...c[localState.turn], move.captured] }));
    }
    setLocalState((s) => makeMove(s, move, promoType));
    setLocalLastMove(move);
    setSelected(null);
    setLegalMoves([]);
    setPromo(null);
  }

  function choosePromo(type) {
    if (!promo) return;
    commitMove(promo.move, type);
  }

  function undo() {
    if (mode !== 'computer' || thinking || promo || gameOver) return;
    if (history.length < 2) return;
    const target = history[history.length - 2];
    setHistory((h) => h.slice(0, h.length - 2));
    setLocalState(target.state);
    setLocalCaptured(target.captured);
    setLocalLastMove(target.lastMove);
    setSelected(null);
    setLegalMoves([]);
  }

  function resetLocal() {
    setLocalState(initialState());
    setSelected(null);
    setLegalMoves([]);
    setLocalCaptured({ w: [], b: [] });
    setLocalLastMove(null);
    setPromo(null);
    setThinking(false);
    setHistory([]);
    setPendingAdvance(false);
  }

  function changeMode(m) {
    leaveOnline();
    setMode(m);
    resetLocal();
  }

  // --- online operations -------------------------------------------------
  async function ensureUser() {
    if (me) return me;
    try {
      const u = await base44.auth.me();
      setMe(u);
      return u;
    } catch {
      return null;
    }
  }

  async function createOnline() {
    setOnlineError('');
    try {
      const user = await ensureUser();
      if (!user) {
        setOnlineError('Sign in to play online.');
        return;
      }
      const code = generateCode();
      const rec = await base44.entities.Game.create({
        code,
        status: 'waiting',
        host_color: 'w',
        white_player_id: user.id,
        black_player_id: null,
        moves: [],
        result: null,
        last_move_at: new Date().toISOString(),
      });
      setOnlineGame(rec);
    } catch (e) {
      setOnlineError('Could not create game.');
    }
  }

  async function joinOnline(code) {
    setOnlineError('');
    try {
      const user = await ensureUser();
      if (!user) {
        setOnlineError('Sign in to play online.');
        return;
      }
      const found = await base44.entities.Game.filter({
        code: code.toUpperCase(),
        status: 'waiting',
      });
      if (!found || found.length === 0) {
        setOnlineError('No open game with that code.');
        return;
      }
      const g = found[0];
      if (g.white_player_id === user.id) {
        setOnlineError('That is your own game — waiting for an opponent.');
        setOnlineGame(g);
        return;
      }
      const updated = await base44.entities.Game.update(g.id, {
        black_player_id: user.id,
        status: 'active',
        last_move_at: new Date().toISOString(),
      });
      setOnlineGame(updated);
    } catch (e) {
      setOnlineError('Could not join game.');
    }
  }

  async function appendMove(stored) {
    if (!onlineGame) return;
    setSubmitting(true);
    setOnlineError('');
    try {
      const newMoves = [...(onlineGame.moves || []), stored];
      const { state: ns } = replayGame(newMoves);
      const st = gameStatus(ns);
      const patch = { moves: newMoves, last_move_at: new Date().toISOString() };
      if (st === 'checkmate') {
        patch.status = 'finished';
        patch.result = ns.turn === 'w' ? 'black_wins' : 'white_wins';
      } else if (st === 'stalemate') {
        patch.status = 'finished';
        patch.result = 'draw';
      }
      const updated = await base44.entities.Game.update(onlineGame.id, patch);
      setOnlineGame(updated);
    } catch (e) {
      setOnlineError('Move failed — retry.');
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveOnline() {
    if (onlineGame && onlineGame.status === 'waiting' && onlineGame.white_player_id === me?.id) {
      try {
        await base44.entities.Game.delete(onlineGame.id);
      } catch {
        // ignore
      }
    }
    setOnlineGame(null);
    setOnlineError('');
    setSubmitting(false);
    setSelected(null);
    setLegalMoves([]);
    refreshOpenGames();
  }

  async function resignOnline() {
    if (!onlineGame || onlineGame.status !== 'active' || !myColor) return;
    try {
      const winner = myColor === 'w' ? 'black_wins' : 'white_wins';
      const updated = await base44.entities.Game.update(onlineGame.id, {
        status: 'finished',
        result: winner,
      });
      setOnlineGame(updated);
    } catch (e) {
      setOnlineError('Could not resign.');
    }
  }

  async function refreshOpenGames() {
    try {
      const list = await base44.entities.Game.filter({ status: 'waiting' }, 'created_date', 50);
      setOpenGames(list || []);
    } catch {
      // ignore
    }
  }

  async function quickMatch() {
    setOnlineError('');
    const user = await ensureUser();
    if (!user) {
      setOnlineError('Sign in to play online.');
      return;
    }
    try {
      const open = await base44.entities.Game.filter({ status: 'waiting' }, 'created_date', 50);
      const joinable = (open || []).find(
        (g) => g.white_player_id !== user.id && !g.black_player_id
      );
      if (joinable) {
        const updated = await base44.entities.Game.update(joinable.id, {
          black_player_id: user.id,
          status: 'active',
          last_move_at: new Date().toISOString(),
        });
        setOnlineGame(updated);
      } else {
        await createOnline();
      }
    } catch (e) {
      setOnlineError('Matchmaking failed.');
    }
  }

  async function joinSpecific(game) {
    setOnlineError('');
    const user = await ensureUser();
    if (!user) {
      setOnlineError('Sign in to play online.');
      return;
    }
    if (game.white_player_id === user.id) {
      setOnlineError('That is your own game.');
      return;
    }
    try {
      const updated = await base44.entities.Game.update(game.id, {
        black_player_id: user.id,
        status: 'active',
        last_move_at: new Date().toISOString(),
      });
      setOnlineGame(updated);
    } catch (e) {
      setOnlineError('Could not join that game.');
    }
  }

  function reenterOwn(game) {
    setOnlineError('');
    setOnlineGame(game);
  }

  // realtime subscription: active-game updates + live lobby refresh
  useEffect(() => {
    if (mode !== 'online') return;
    refreshOpenGames();
    const unsub = base44.entities.Game.subscribe((event) => {
      if (!event || !event.data) return;
      if (onlineGame && event.data.id === onlineGame.id) {
        setOnlineGame(event.data);
      }
      if (!onlineGame) refreshOpenGames();
    });
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGame?.id]);

  // computer AI
  useEffect(() => {
    if (mode !== 'computer' || turn !== 'b' || gameOver || promo) return;
    setThinking(true);
    const t = setTimeout(() => {
      const move = bestMove(localState, 'b', difficulty);
      if (move) commitMove(move, 'Q');
      setThinking(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver, promo, localState, difficulty, turn]);

  // offer to advance after beating the computer
  useEffect(() => {
    if (mode === 'computer' && status === 'checkmate' && turn === 'b' && difficulty < 8) {
      setPendingAdvance(true);
    }
  }, [status, turn, mode, difficulty]);

  function advance() {
    setDifficulty((d) => Math.min(8, d + 1));
    setPendingAdvance(false);
    resetLocal();
  }

  function stay() {
    setPendingAdvance(false);
  }

  let statusText = {
    playing: `${turn === 'w' ? 'White' : 'Black'} to move`,
    check: `${turn === 'w' ? 'White' : 'Black'} is in check`,
    checkmate: `Checkmate — ${turn === 'w' ? 'Black' : 'White'} wins`,
    stalemate: 'Stalemate — draw',
  }[status] || 'Loading…';
  if (thinking) statusText = 'Computer is thinking…';
  if (mode === 'online') {
    if (!onlineGame) statusText = 'Create or join a game';
    else if (onlineGame.status === 'waiting') statusText = 'Waiting for opponent…';
    else if (onlineGame.status === 'active') {
      if (submitting) statusText = 'Sending move…';
      else if (gameOver)
        statusText =
          status === 'checkmate'
            ? `Checkmate — ${turn === 'w' ? 'Black' : 'White'} wins`
            : 'Stalemate — draw';
      else if (myColor && turn === myColor) statusText = 'Your move';
      else statusText = `Waiting for ${turn === 'w' ? 'White' : 'Black'}…`;
    } else if (onlineGame.status === 'finished') {
      const won =
        (onlineGame.result === 'white_wins' && myColor === 'w') ||
        (onlineGame.result === 'black_wins' && myColor === 'b');
      statusText =
        onlineGame.result === 'draw' ? 'Draw' : won ? 'You won!' : 'You lost';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-600/80">
            A Chess Variant
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-display font-semibold tracking-tight text-stone-800">
            Truth Chess
          </h1>
          <p className="mt-3 text-sm sm:text-base text-stone-500 max-w-xl mx-auto">
            A 10×8 board with a new piece — <span className="font-medium text-stone-700">Truth</span> —
            flanking the Queen and King, with a pawn in front of every piece. Truth moves like a Queen,
            cannot capture any piece, and cannot be captured except by the opposing King — a passive blocker.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="flex flex-col items-center">
            {state ? (
              <>
                <CapturedRow pieces={captured.w} label="White has captured" />
                <div className="my-3 w-full flex justify-center">
                  <ChessBoard
                    board={state.board}
                    selected={selected}
                    legalMoves={legalMoves}
                    lastMove={lastMove}
                    onSquareClick={handleSquareClick}
                  />
                </div>
                <CapturedRow pieces={captured.b} label="Black has captured" />
              </>
            ) : (
              <div className="w-full max-w-[620px] aspect-[10/8] rounded-2xl bg-white/60 ring-1 ring-stone-200 flex items-center justify-center text-stone-400 text-sm text-center px-6">
                Create or join an online game to start playing
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
              <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => changeMode('local')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition ${
                    mode === 'local' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  2 Players
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('computer')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition ${
                    mode === 'computer' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  vs Computer
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('online')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition ${
                    mode === 'online' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  Online
                </button>
              </div>

              {mode === 'computer' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-widest text-stone-400">Difficulty</p>
                    <span className="text-xs font-semibold text-stone-700">Level {difficulty}/8</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                </div>
              )}

              {mode !== 'online' && (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${
                        turn === 'w' ? 'bg-stone-100 ring-1 ring-stone-400' : 'bg-stone-800'
                      }`}
                    />
                    <div>
                      <p className="text-xs uppercase tracking-widest text-stone-400">Status</p>
                      <p
                        className={`text-lg font-medium ${
                          status === 'check' || status === 'checkmate'
                            ? 'text-rose-600'
                            : 'text-stone-800'
                        }`}
                      >
                        {statusText}
                      </p>
                    </div>
                  </div>
                  {mode === 'computer' ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        onClick={undo}
                        variant="outline"
                        disabled={thinking || history.length < 2 || gameOver || promo}
                      >
                        Undo
                      </Button>
                      <Button onClick={resetLocal} variant="outline">
                        New Game
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={resetLocal} variant="outline" className="mt-4 w-full">
                      New Game
                    </Button>
                  )}
                </>
              )}
            </div>

            {mode === 'online' && (
              <OnlinePanel
                onlineGame={onlineGame}
                myColor={myColor}
                myId={me?.id}
                openGames={openGames}
                statusText={statusText}
                onlineError={onlineError}
                onQuickMatch={quickMatch}
                onCreate={createOnline}
                onJoinCode={joinOnline}
                onJoinGame={joinSpecific}
                onReenterOwn={reenterOwn}
                onLeave={leaveOnline}
                onResign={resignOnline}
              />
            )}

            {mode !== 'online' && (
              <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">How to play</p>
                <ul className="space-y-2 text-sm text-stone-600 leading-relaxed">
                  <li>• Tap a piece to see its legal moves, then tap a highlighted square to move.</li>
                  <li>• Standard chess rules apply on a 10-wide board, including castling and en passant.</li>
                  <li>
                    • <span className="font-medium text-stone-800">Truth</span> (the † cross piece) moves like a
                    Queen but cannot capture any piece, and cannot be captured by any piece except the
                    opposing King — it acts as a passive blocker.
                  </li>
                  <li>• Pawns reaching the last rank promote (choose Q, R, B, or N).</li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {promo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[300px]">
            <p className="text-center text-sm font-medium text-stone-600 mb-4">Promote pawn to:</p>
            <div className="grid grid-cols-4 gap-2">
              {['Q', 'R', 'B', 'N'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => choosePromo(t)}
                  className="aspect-square rounded-xl bg-stone-50 ring-1 ring-stone-200 hover:bg-amber-100 hover:ring-amber-400 transition flex items-center justify-center"
                >
                  <span
                    className="leading-none"
                    style={{
                      fontSize: '2rem',
                      color: promo.color === 'w' ? '#f8fafc' : '#1f2937',
                      textShadow:
                        promo.color === 'w'
                          ? '0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.85)'
                          : '0 1px 1px rgba(255,255,255,0.25)',
                    }}
                  >
                    {GLYPHS[t]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pendingAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[300px] text-center">
            <p className="text-lg font-semibold text-stone-800">You beat Level {difficulty}!</p>
            <p className="text-sm text-stone-500 mt-1 mb-4">Advance to the next difficulty?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={stay} variant="outline">Stay</Button>
              <Button onClick={advance}>Level {Math.min(8, difficulty + 1)}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapturedRow({ pieces, label }) {
  return (
    <div className="w-full max-w-[620px] mx-auto h-7 flex items-center gap-1 px-1">
      <span className="text-[0.65rem] uppercase tracking-widest text-stone-400 mr-1 hidden sm:inline">
        {label}
      </span>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="leading-none"
          style={{
            fontSize: '1.1rem',
            color: p.color === 'w' ? '#cbd5e1' : '#475569',
            textShadow: p.color === 'w' ? '0 0 1px rgba(0,0,0,0.6)' : 'none',
          }}
        >
          {GLYPHS[p.type]}
        </span>
      ))}
    </div>
  );
}