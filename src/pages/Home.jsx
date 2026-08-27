import React, { useState, useMemo, useEffect } from 'react';
import ChessBoard from '@/components/ChessBoard';
import {
  initialState,
  legalMovesFor,
  gameStatus,
  makeMove,
} from '@/lib/chessVariant';
import { bestMove } from '@/lib/chessAI';
import { Button } from '@/components/ui/button';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };

export default function Home() {
  const [state, setState] = useState(initialState);
  const board = state.board;
  const turn = state.turn;
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [captured, setCaptured] = useState({ w: [], b: [] });
  const [lastMove, setLastMove] = useState(null);
  const [promo, setPromo] = useState(null);
  const [vsComputer, setVsComputer] = useState(false);
  const [thinking, setThinking] = useState(false);

  const status = useMemo(() => gameStatus(state), [state]);
  const gameOver = status === 'checkmate' || status === 'stalemate';

  function handleSquareClick(r, f) {
    if (gameOver || promo) return;
    if (vsComputer && turn === 'b') return;
    const piece = board[r][f];
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
      setSelected([r, f]);
      setLegalMoves(legalMovesFor(state, r, f));
    }
  }

  function commitMove(move, promoType) {
    if (move.captured) {
      setCaptured((c) => ({ ...c, [turn]: [...c[turn], move.captured] }));
    }
    setState((s) => makeMove(s, move, promoType));
    setLastMove(move);
    setSelected(null);
    setLegalMoves([]);
    setPromo(null);
  }

  function choosePromo(type) {
    if (!promo) return;
    commitMove(promo.move, type);
  }

  function reset() {
    setState(initialState());
    setSelected(null);
    setLegalMoves([]);
    setCaptured({ w: [], b: [] });
    setLastMove(null);
    setPromo(null);
    setThinking(false);
  }

  useEffect(() => {
    if (!vsComputer || turn !== 'b' || gameOver || promo) return;
    setThinking(true);
    const t = setTimeout(() => {
      const move = bestMove(state, 'b', 2);
      if (move) commitMove(move, 'Q');
      setThinking(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsComputer, gameOver, promo, state]);

  function setMode(computer) {
    setVsComputer(computer);
    reset();
  }

  let statusText = {
    playing: `${turn === 'w' ? 'White' : 'Black'} to move`,
    check: `${turn === 'w' ? 'White' : 'Black'} is in check`,
    checkmate: `Checkmate — ${turn === 'w' ? 'Black' : 'White'} wins`,
    stalemate: 'Stalemate — draw',
  }[status];
  if (thinking) statusText = 'Computer is thinking…';

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
            <CapturedRow pieces={captured.w} label="White has captured" />
            <div className="my-3 w-full flex justify-center">
              <ChessBoard
                board={board}
                selected={selected}
                legalMoves={legalMoves}
                lastMove={lastMove}
                onSquareClick={handleSquareClick}
              />
            </div>
            <CapturedRow pieces={captured.b} label="Black has captured" />
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
              <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setMode(false)}
                  className={`py-1.5 text-xs font-medium rounded-lg transition ${
                    !vsComputer ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  2 Players
                </button>
                <button
                  type="button"
                  onClick={() => setMode(true)}
                  className={`py-1.5 text-xs font-medium rounded-lg transition ${
                    vsComputer ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  vs Computer
                </button>
              </div>
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
              <Button onClick={reset} variant="outline" className="mt-4 w-full">
                New Game
              </Button>
            </div>

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
          </aside>
        </div>
      </div>

      {promo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[300px]">
            <p className="text-center text-sm font-medium text-stone-600 mb-4">
              Promote pawn to:
            </p>
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