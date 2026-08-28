import React, { useState, useMemo, useEffect, useRef } from 'react';
import ChessBoard from '@/components/ChessBoard';
import {
  initialState,
  legalMovesFor,
  allLegalMoves,
  gameStatus,
  makeMove,
  findKing,
  positionKey,
} from '@/lib/chessVariant';
import { bestMove, DIFFICULTIES } from '@/lib/chessAI';
import { rollOpeningTarget, recordMate, updateAggression } from '@/lib/aiLearning';
import { generateCode, replayGame, replayStates, serializeMove } from '@/lib/onlineGame';
import { randomOpening, bookMove } from '@/lib/openings';
import { movesToSAN, classifyMove, hasThreefold } from '@/lib/chessNotation';
import { useChessSounds } from '@/hooks/useChessSounds';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import OnlinePanel from '@/components/OnlinePanel';
import Leaderboard from '@/components/Leaderboard';
import MoveHistory from '@/components/MoveHistory';
import ReplayBar from '@/components/ReplayBar';
import ThemePicker from '@/components/ThemePicker';
import ClockBar from '@/components/ClockBar';
import StatsPanel from '@/components/StatsPanel';
import { isMobileApp } from '@/lib/isMobileApp';
import CheckmateEstimate from '@/components/CheckmateEstimate';
import ShareMoves from '@/components/ShareMoves';
import GameOverBanner from '@/components/GameOverBanner';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };

const TIME_CONTROLS = {
  unlimited: { label: 'Unlimited', initial: null, inc: 0 },
  '3+2': { label: '3+2 Blitz', initial: 180, inc: 2 },
  '5+0': { label: '5+0 Bullet', initial: 300, inc: 0 },
  '10+0': { label: '10+0 Rapid', initial: 600, inc: 0 },
  '15+10': { label: '15+10', initial: 900, inc: 10 },
};

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

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
  // Opening book shared by AI-vs-AI and vs-Computer: a randomly chosen
  // traditional opening for the current game. The index into the book is just
  // localMoves.length, so it stays aligned with actual play.
  const openingRef = useRef({ book: null, wTarget: null, bTarget: null });
  const recordedRef = useRef(false);
  const kingOnlySinceRef = useRef(null);

  // batch-1 additions
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(true);
  const [hint, setHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [startMs, setStartMs] = useState(Date.now());
  const prevMovesLen = useRef(0);
  const playSound = useChessSounds(soundOn);

  // batch-2 additions
  const [localMoves, setLocalMoves] = useState([]);
  const [drawAgreed, setDrawAgreed] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('tc-board-theme') || 'classic');
  const [pieceStyle, setPieceStyle] = useState(() => localStorage.getItem('tc-piece-style') || 'figurine');
  const [timeControl, setTimeControl] = useState('unlimited');
  const [whiteClock, setWhiteClock] = useState(null);
  const [blackClock, setBlackClock] = useState(null);
  const [timedOut, setTimedOut] = useState(null);
  const [animateMove, setAnimateMove] = useState(null);
  const [showPro, setShowPro] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => localStorage.setItem('tc-board-theme', boardTheme), [boardTheme]);
  useEffect(() => localStorage.setItem('tc-piece-style', pieceStyle), [pieceStyle]);

  // online
  const [me, setMe] = useState(null);
  const [onlineGame, setOnlineGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [openGames, setOpenGames] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [ghostOpponent, setGhostOpponent] = useState(false);
  const [spectator, setSpectator] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => setMe(null));
  }, []);

  const isPro = me?.plan === 'pro';
  // Base44 Payments can't sell digital subscriptions inside mobile app stores,
  // so the Pro upgrade path is only shown in browsers (web), not the native apps.
  const canUpgrade = !isMobileApp();

  // Free users are capped at AI level 3; clamp if they lose Pro mid-session.
  useEffect(() => {
    if (!isPro && difficulty > 3) setDifficulty(3);
  }, [isPro, difficulty]);

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

  // threefold repetition (50-move is already in `status` via the engine)
  const threefold = useMemo(() => {
    if (mode === 'online' && onlineGame) return hasThreefold(onlineGame.moves || []);
    return hasThreefold(localMoves);
  }, [mode, onlineGame, localMoves]);

  const localOver = mode !== 'online' && (resigned || drawAgreed || !!timedOut);
  const gameOver =
    status === 'checkmate' ||
    status === 'stalemate' ||
    status === 'fifty_move' ||
    threefold ||
    localOver;

  const moveSanDisplay = useMemo(() => {
    if (mode === 'online' && onlineGame) return movesToSAN(onlineGame.moves || []);
    return movesToSAN(localMoves);
  }, [mode, onlineGame, localMoves]);

  // per-move snapshots for post-game replay (index 0 = initial position)
  const positionList = useMemo(() => {
    if (mode === 'online' && onlineGame) return replayStates(onlineGame.moves || []);
    return replayStates(localMoves);
  }, [mode, onlineGame, localMoves]);

  const reviewing = reviewIdx !== null;
  const viewIndex = reviewing
    ? Math.max(0, Math.min(reviewIdx, positionList.length - 1))
    : Math.max(0, positionList.length - 1);
  const view = positionList[viewIndex] || { state, captured, lastMove };
  const viewState = view.state;
  const viewCaptured = view.captured || { w: [], b: [] };
  const viewLastMove = view.lastMove || null;
  const viewStatus = useMemo(() => (viewState ? gameStatus(viewState) : 'playing'), [viewState]);
  const viewCheck =
    viewStatus === 'check' || viewStatus === 'checkmate'
      ? findKing(viewState.board, viewState.turn)
      : null;

  const effectiveFlipped = useMemo(() => {
    if (mode === 'local') return autoFlip ? turn === 'b' : flipped;
    if (mode === 'online') return myColor === 'b' ? !flipped : flipped;
    return flipped; // computer
  }, [mode, autoFlip, turn, flipped, myColor]);

  const humanToMove = useMemo(() => {
    if (!state || gameOver || resigned || drawAgreed || submitting || promo || reviewing) return false;
    if (mode === 'local') return true;
    if (mode === 'computer') return turn === 'w';
    if (mode === 'online') return onlineGame?.status === 'active' && !!myColor && turn === myColor;
    return false;
  }, [state, gameOver, resigned, drawAgreed, submitting, promo, reviewing, mode, turn, myColor, onlineGame?.status]);

  const resultStr = useMemo(() => {
    if (mode === 'online' && onlineGame) {
      if (!onlineGame.result) return '*';
      return onlineGame.result === 'white_wins'
        ? '1-0'
        : onlineGame.result === 'black_wins'
        ? '0-1'
        : '1/2-1/2';
    }
    if (timedOut) return timedOut === 'w' ? '0-1' : '1-0';
    if (drawAgreed) return '1/2-1/2';
    if (resigned) return turn === 'w' ? '0-1' : '1-0';
    if (status === 'checkmate') return turn === 'w' ? '0-1' : '1-0';
    if (status === 'stalemate' || status === 'fifty_move' || threefold) return '1/2-1/2';
    return '*';
  }, [mode, onlineGame, drawAgreed, resigned, turn, status, threefold]);

  function handleSquareClick(r, f) {
    if (reviewing || gameOver || promo || submitting) return;
    if (mode === 'cvc' || mode === 'cvc_turbo') return;
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
        setHint(null);
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
      setHint(null);
    }
  }

  function handleDropMove(from, to) {
    if (reviewing || gameOver || promo || submitting) return;
    if (mode === 'cvc' || mode === 'cvc_turbo') return;
    if (mode === 'computer' && turn === 'b') return;
    if (mode === 'online') {
      if (!onlineGame || onlineGame.status !== 'active' || !myColor || turn !== myColor) return;
    }
    const piece = state.board[from[0]][from[1]];
    if (!piece || piece.color !== turn) return;
    const moves = legalMovesFor(state, from[0], from[1]);
    const move = moves.find((m) => m.to[0] === to[0] && m.to[1] === to[1]);
    if (!move) return;
    if (move.promotion) {
      setSelected(null);
      setLegalMoves([]);
      setPromo({ move, color: turn });
      return;
    }
    commitMove(move, 'Q');
  }

  function commitMove(move, promoType) {
    if (mode === 'online') {
      setSelected(null);
      setLegalMoves([]);
      setPromo(null);
      setHint(null);
      appendMove(serializeMove(move, promoType));
      return;
    }
    const ns = makeMove(localState, move, promoType);
    const st = gameStatus(ns);
    if (st === 'checkmate' || st === 'stalemate' || st === 'fifty_move') playSound('mate');
    else if (st === 'check') playSound('check');
    else if (move.captured) playSound('capture');
    else playSound('move');

    setLocalMoves((m) => [...m, serializeMove(move, promoType)]);
    setHistory((h) => [...h, { state: localState, captured: localCaptured, lastMove: localLastMove }]);
    if (move.captured) {
      setLocalCaptured((c) => ({ ...c, [localState.turn]: [...c[localState.turn], move.captured] }));
    }
    if (timeControl !== 'unlimited') {
      const inc = TIME_CONTROLS[timeControl].inc;
      if (localState.turn === 'w') setWhiteClock((c) => (c ?? 0) + inc);
      else setBlackClock((c) => (c ?? 0) + inc);
    }
    setAnimateMove({ from: move.from, to: move.to, piece: move.piece, color: localState.turn, key: Date.now() });
    setLocalState(ns);
    setLocalLastMove(move);
    setSelected(null);
    setLegalMoves([]);
    setPromo(null);
    setHint(null);
    setReviewIdx(null);
  }

  function choosePromo(type) {
    if (!promo) return;
    commitMove(promo.move, type);
  }

  // If `move` would repeat a position for the 3rd time (threefold), fall back to
  // the first legal move that doesn't. Used for the computer and AI-vs-AI
  // engines so they never trigger a threefold draw; human moves are unaffected.
  function pickNonRepeating(state, move, moves) {
    const keys = [positionKey(initialState())];
    let st = initialState();
    for (const m of moves) {
      st = makeMove(st, m, m.promoType || 'Q');
      keys.push(positionKey(st));
    }
    const occ = (k) => keys.reduce((n, hk) => (hk === k ? n + 1 : n), 0);
    const ck = positionKey(makeMove(state, move, move.promotion ? 'Q' : 'Q'));
    if (occ(ck) < 2) return move;
    const safe = allLegalMoves(state, state.turn).find((am) => {
      const ak = positionKey(makeMove(state, am, am.promotion ? 'Q' : 'Q'));
      return occ(ak) < 2;
    });
    return safe || move;
  }

  function undo() {
    if (mode !== 'computer' || thinking || promo || gameOver) return;
    if (history.length < 2) return;
    const target = history[history.length - 2];
    setHistory((h) => h.slice(0, h.length - 2));
    setLocalMoves((m) => m.slice(0, Math.max(0, m.length - 2)));
    setLocalState(target.state);
    setLocalCaptured(target.captured);
    setLocalLastMove(target.lastMove);
    setSelected(null);
    setLegalMoves([]);
    setHint(null);
    setReviewIdx(null);
  }

  function resign() {
    if (mode === 'online') {
      resignOnline();
      return;
    }
    if (gameOver || resigned) return;
    setResigned(true);
    playSound('mate');
  }

  function offerDraw() {
    if (mode !== 'local' || gameOver) return;
    setDrawAgreed(true);
    playSound('mate');
  }

  function showHint() {
    if (!humanToMove || hintLoading) return;
    setHintLoading(true);
    setTimeout(() => {
      const m = bestMove(state, turn, 5);
      setHint(m);
      setHintLoading(false);
    }, 30);
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
    setHint(null);
    setHintLoading(false);
    setResigned(false);
    setDrawAgreed(false);
    setTimedOut(null);
    setLocalMoves([]);
    setReviewIdx(null);
    const tc = TIME_CONTROLS[timeControl];
    setWhiteClock(tc.initial);
    setBlackClock(tc.initial);
    setStartMs(Date.now());
    setElapsed(0);
    openingRef.current = { book: null, wTarget: null, bTarget: null };
    recordedRef.current = false;
    kingOnlySinceRef.current = null;
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

  // Free users get 3 online games/day; Pro is unlimited.
  async function onlineQuotaRemaining() {
    if (!me) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const [w, b] = await Promise.all([
        base44.entities.Game.filter({ white_player_id: me.id, created_date: { $gte: start.toISOString() } }),
        base44.entities.Game.filter({ black_player_id: me.id, created_date: { $gte: start.toISOString() } }),
      ]);
      return Math.max(0, 3 - ((w?.length || 0) + (b?.length || 0)));
    } catch {
      return 3;
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
      if (!isPro) {
        const rem = await onlineQuotaRemaining();
        if (rem <= 0) {
          setOnlineError(canUpgrade ? 'Daily free online limit reached — upgrade to Pro.' : 'Daily free online limit reached.');
          if (canUpgrade) setShowPro(true);
          return;
        }
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
      prevMovesLen.current = 0;
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
        prevMovesLen.current = g.moves?.length || 0;
        setOnlineGame(g);
        return;
      }
      const updated = await base44.entities.Game.update(g.id, {
        black_player_id: user.id,
        status: 'active',
        last_move_at: new Date().toISOString(),
      });
      prevMovesLen.current = 0;
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
      const patch = { moves: newMoves, last_move_at: new Date().toISOString(), draw_offer_by: null };
      if (st === 'checkmate') {
        patch.status = 'finished';
        patch.result = ns.turn === 'w' ? 'black_wins' : 'white_wins';
      } else if (st === 'stalemate' || st === 'fifty_move' || hasThreefold(newMoves)) {
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
    if (onlineGame) {
      if (ghostOpponent) {
        try {
          await base44.entities.Game.delete(onlineGame.id);
        } catch {
          // ignore
        }
      } else if (onlineGame.status === 'waiting' && onlineGame.white_player_id === me?.id) {
        try {
          await base44.entities.Game.delete(onlineGame.id);
        } catch {
          // ignore
        }
      }
    }
    setGhostOpponent(false);
    setSpectator(false);
    setOnlineGame(null);
    setOnlineError('');
    setSubmitting(false);
    setSelected(null);
    setLegalMoves([]);
    prevMovesLen.current = 0;
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

  async function offerDrawOnline() {
    if (!onlineGame || onlineGame.status !== 'active' || !myColor) return;
    try {
      const updated = await base44.entities.Game.update(onlineGame.id, { draw_offer_by: myColor });
      setOnlineGame(updated);
    } catch {
      setOnlineError('Could not offer draw.');
    }
  }

  async function acceptDrawOnline() {
    if (!onlineGame || onlineGame.status !== 'active') return;
    try {
      const updated = await base44.entities.Game.update(onlineGame.id, {
        status: 'finished',
        result: 'draw',
        draw_offer_by: null,
      });
      setOnlineGame(updated);
    } catch {
      setOnlineError('Could not accept draw.');
    }
  }

  async function declineDrawOnline() {
    if (!onlineGame) return;
    try {
      const updated = await base44.entities.Game.update(onlineGame.id, { draw_offer_by: null });
      setOnlineGame(updated);
    } catch {
      setOnlineError('Could not decline draw.');
    }
  }

  async function upgrade() {
    setUpgrading(true);
    try {
      const res = await base44.functions.invoke('create-checkout', { productId: 'pro_monthly' });
      if (res?.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
      setOnlineError('Could not start checkout.');
    } catch {
      setOnlineError('Could not start checkout.');
    }
    setUpgrading(false);
  }

  async function refreshOpenGames() {
    try {
      const [waiting, active] = await Promise.all([
        base44.entities.Game.filter({ status: 'waiting' }, 'created_date', 50),
        base44.entities.Game.filter({ status: 'active' }, 'created_date', 50),
      ]);
      setOpenGames(waiting || []);
      setActiveGames(active || []);
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
    if (!isPro) {
      const rem = await onlineQuotaRemaining();
      if (rem <= 0) {
        setOnlineError(canUpgrade ? 'Daily free online limit reached — upgrade to Pro.' : 'Daily free online limit reached.');
        if (canUpgrade) setShowPro(true);
        return;
      }
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
        prevMovesLen.current = 0;
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
      prevMovesLen.current = 0;
      setOnlineGame(updated);
    } catch (e) {
      setOnlineError('Could not join that game.');
    }
  }

  function reenterOwn(game) {
    setOnlineError('');
    prevMovesLen.current = game.moves?.length || 0;
    setOnlineGame(game);
  }

  function watchGame(game) {
    setOnlineError('');
    setSpectator(true);
    prevMovesLen.current = game.moves?.length || 0;
    setOnlineGame(game);
  }

  async function startGhost() {
    setOnlineError('');
    const user = await ensureUser();
    if (!user) {
      setOnlineError('Sign in to play online.');
      return;
    }
    try {
      const code = generateCode();
      const rec = await base44.entities.Game.create({
        code,
        status: 'active',
        host_color: 'w',
        white_player_id: user.id,
        black_player_id: '__ghost__',
        moves: [],
        result: null,
        last_move_at: new Date().toISOString(),
      });
      prevMovesLen.current = 0;
      setGhostOpponent(true);
      setOnlineGame(rec);
    } catch (e) {
      setOnlineError('Could not start ghost game.');
    }
  }

  // realtime subscription: active-game updates + live lobby refresh + sounds
  useEffect(() => {
    if (mode !== 'online') return;
    refreshOpenGames();
    const unsub = base44.entities.Game.subscribe((event) => {
      if (!event || !event.data) return;
      if (onlineGame && event.data.id === onlineGame.id) {
        const newLen = (event.data.moves || []).length;
        if (newLen > prevMovesLen.current) {
          const kind = classifyMove(event.data.moves);
          playSound(kind === 'mate' || kind === 'stale' ? 'mate' : kind);
          const lastMv = event.data.moves[newLen - 1];
          try {
            const pre = replayStates(event.data.moves.slice(0, -1));
            const preState = pre[pre.length - 1].state;
            const pc = preState.board[lastMv.from[0]][lastMv.from[1]];
            if (pc) setAnimateMove({ from: lastMv.from, to: lastMv.to, piece: pc, color: pc.color, key: Date.now() });
          } catch {
            // ignore animation failure
          }
          prevMovesLen.current = newLen;
        }
        setOnlineGame(event.data);
      }
      if (!onlineGame) refreshOpenGames();
    });
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGame?.id]);

  useEffect(() => {
    if (mode === 'online' && onlineGame?.status === 'active') {
      setStartMs(Date.now());
      setElapsed(0);
      prevMovesLen.current = onlineGame.moves?.length || 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGame?.status, onlineGame?.id]);

  // elapsed count-up (online, or local/computer with unlimited time)
  useEffect(() => {
    const useElapsed = mode === 'online' || timeControl === 'unlimited';
    const active = mode === 'online' ? onlineGame?.status === 'active' && !gameOver : !gameOver;
    if (!useElapsed || !active) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, gameOver, mode, onlineGame?.status, timeControl]);

  // per-side countdown clocks (local & computer, timed control)
  useEffect(() => {
    if (mode === 'online' || gameOver || timeControl === 'unlimited') return undefined;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (turn === 'w') setWhiteClock((c) => Math.max(0, (c ?? 0) - dt));
      else setBlackClock((c) => Math.max(0, (c ?? 0) - dt));
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver, timeControl, turn]);

  // flag on time out
  useEffect(() => {
    if (mode === 'online' || gameOver || timeControl === 'unlimited' || timedOut) return;
    if (whiteClock !== null && whiteClock <= 0) {
      setTimedOut('w');
      playSound('mate');
    } else if (blackClock !== null && blackClock <= 0) {
      setTimedOut('b');
      playSound('mate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteClock, blackClock, mode, gameOver, timeControl]);

  // computer AI: opens with a randomly chosen traditional opening (one of
  // twenty-three) for as long as the human's moves keep the book on track, then
  // plays the search engine. Never allows threefold repetition.
  useEffect(() => {
    if (mode !== 'computer' || turn !== 'b' || gameOver || promo) return;
    if (!openingRef.current.book) {
      openingRef.current = { book: randomOpening(), bTarget: rollOpeningTarget('b', localState.board) };
    }
    setThinking(true);
    const t = setTimeout(() => {
      const legal = allLegalMoves(localState, 'b');
      const scripted = openingRef.current.bTarget
        ? null
        : bookMove(openingRef.current.book, localMoves.length, legal, 'b');
      let move;
      if (scripted) move = scripted;
      else {
        const ctx = {
          ply: localMoves.length,
          wTarget: null,
          bTarget: openingRef.current.bTarget ? openingRef.current.bTarget.type : null,
        };
        move = bestMove(localState, 'b', difficulty, false, ctx);
        if (move) move = pickNonRepeating(localState, move, localMoves);
      }
      if (move) commitMove(move, 'Q');
      setThinking(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver, promo, localState, difficulty, turn, localMoves]);

  // computer vs computer: each side opens with a randomly chosen traditional
  // opening (one of twenty-three), then auto-plays at level 6 — aggressively
  // pursuing checkmate and never allowing threefold repetition. Move cadence
  // varies slightly (0.91 / 1.5 / 2 s) so the rhythm feels natural.
  useEffect(() => {
    if ((mode !== 'cvc' && mode !== 'cvc_turbo') || gameOver || promo) return;
    // A fresh game (no moves yet) picks a new opening for this exhibition and,
    // per side, may roll an opening target (a random enemy piece to attack).
    if (localMoves.length === 0) {
      openingRef.current = {
        book: randomOpening(),
        wTarget: rollOpeningTarget('w', localState.board),
        bTarget: rollOpeningTarget('b', localState.board),
      };
    }
    // King vs King visual: if only the two kings remain, after 4 plies speed up
    // the move cadence so the endgame looks lively on screen.
    let onlyKings = true;
    for (let r = 0; r < 9 && onlyKings; r++) {
      for (let f = 0; f < 10; f++) {
        const p = localState.board[r][f];
        if (p && p.type !== 'K') { onlyKings = false; break; }
      }
    }
    if (onlyKings) {
      if (kingOnlySinceRef.current == null) kingOnlySinceRef.current = localMoves.length;
    } else {
      kingOnlySinceRef.current = null;
    }
    const fastKings = onlyKings && localMoves.length - kingOnlySinceRef.current >= 4;
    setThinking(true);
    const baseDelay = mode === 'cvc_turbo' ? 500 : [910, 1500, 2000][Math.floor(Math.random() * 3)];
    const delay = fastKings ? 120 : baseDelay;
    const t = setTimeout(() => {
      const legal = allLegalMoves(localState, localState.turn);
      const sideTarget = localState.turn === 'w' ? openingRef.current.wTarget : openingRef.current.bTarget;
      // If this side is in target mode this game, skip the opening book and let
      // the search drive pawns at the chosen enemy piece.
      const scripted = sideTarget
        ? null
        : bookMove(openingRef.current.book, localMoves.length, legal, localState.turn);
      let move;
      if (scripted) {
        move = scripted;
      } else {
        const ctx = {
          ply: localMoves.length,
          wTarget: openingRef.current.wTarget ? openingRef.current.wTarget.type : null,
          bTarget: openingRef.current.bTarget ? openingRef.current.bTarget.type : null,
        };
        move = bestMove(localState, localState.turn, mode === 'cvc_turbo' ? 3 : 7, true, ctx);
        if (move) move = pickNonRepeating(localState, move, localMoves);
      }
      if (move) commitMove(move, 'Q');
      setThinking(false);
    }, delay);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver, promo, localState, turn, localMoves]);

  // ghost opponent: AI plays the other side over the online channel (test mode)
  useEffect(() => {
    if (mode !== 'online' || !ghostOpponent || !onlineGame || onlineGame.status !== 'active') return;
    if (!state || gameOver || submitting || promo) return;
    if (turn === myColor) return;
    setThinking(true);
    const t = setTimeout(() => {
      const move = bestMove(state, turn, difficulty);
      if (move) appendMove(serializeMove(move, 'Q'));
      setThinking(false);
    }, 400);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ghostOpponent, onlineGame, state, turn, myColor, gameOver, submitting, promo, difficulty]);

  useEffect(() => {
    if (mode === 'computer' && status === 'checkmate' && turn === 'b' && difficulty < 8) {
      setPendingAdvance(true);
    }
  }, [status, turn, mode, difficulty]);

  // Self-play learning (AI vs AI only): when a game ends, record the mating
  // line into the mate book and tune aggression from how fast it ended.
  useEffect(() => {
    if (mode !== 'cvc' && mode !== 'cvc_turbo') {
      recordedRef.current = false;
      return;
    }
    if (!gameOver) {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;
    if (status === 'checkmate') {
      recordMate(positionList);
      updateAggression(localMoves.length);
    } else {
      updateAggression(null);
    }
  }, [mode, gameOver, status, positionList, localMoves.length]);

  function advance() {
    setDifficulty((d) => Math.min(8, d + 1));
    setPendingAdvance(false);
    resetLocal();
  }

  function stay() {
    setPendingAdvance(false);
  }

  let statusText;
  if (mode === 'online' && onlineGame) {
    if (onlineGame.status === 'waiting') {
      statusText = 'Waiting for opponent…';
    } else if (onlineGame.status === 'finished') {
      statusText =
        onlineGame.result === 'draw'
          ? 'Draw'
          : onlineGame.result === 'white_wins'
          ? 'White wins'
          : onlineGame.result === 'black_wins'
          ? 'Black wins'
          : `${turn === 'w' ? 'White' : 'Black'}'s move`;
    } else {
      statusText = `${turn === 'w' ? 'White' : 'Black'}'s move`;
    }
  } else if (gameOver) {
    if (timedOut) statusText = `${timedOut === 'w' ? 'White' : 'Black'} loses on time`;
    else if (drawAgreed) statusText = 'Draw by agreement';
    else if (resigned)
      statusText =
        mode === 'computer'
          ? 'You resigned — Computer wins'
          : `${turn === 'w' ? 'Black' : 'White'} wins by resignation`;
    else if (status === 'checkmate')
      statusText = `Checkmate — ${turn === 'w' ? 'Black' : 'White'} wins`;
    else if (status === 'stalemate') statusText = 'Stalemate — draw';
    else if (status === 'fifty_move') statusText = 'Draw — 50-move rule';
    else if (threefold) statusText = 'Draw — threefold repetition';
    else statusText = `${turn === 'w' ? 'White' : 'Black'}'s move`;
  } else {
    statusText = `${turn === 'w' ? 'White' : 'Black'}'s move`;
  }

  const showDifficulty = mode === 'computer' || (mode === 'online' && ghostOpponent);

  const banner = useMemo(() => {
    if (status === 'checkmate') return { title: 'Checkmate', subtitle: `${turn === 'w' ? 'Black' : 'White'} wins` };
    if (status === 'stalemate') return { title: 'Stalemate', subtitle: 'Draw' };
    if (status === 'fifty_move') return { title: 'Draw', subtitle: '50-move rule' };
    if (threefold) return { title: 'Draw', subtitle: 'Threefold repetition' };
    if (drawAgreed) return { title: 'Draw', subtitle: 'By agreement' };
    return null;
  }, [status, turn, threefold, drawAgreed]);

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
            A 10×9 board with a new piece — <span className="font-medium text-stone-700">Truth</span> —
            flanking the Queen and King, with a pawn in front of every piece. Truth moves like a Queen,
            captures only the opposing Truth, and is captured only by the opposing King or an opposing Truth.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[620px] mb-3 space-y-2">
              <div className="grid grid-cols-5 gap-1 p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => changeMode('local')}
                  className={`py-1.5 text-[0.65rem] font-medium rounded-lg transition ${
                    mode === 'local' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  2 Players
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('computer')}
                  className={`py-1.5 text-[0.65rem] font-medium rounded-lg transition ${
                    mode === 'computer' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  vs Computer
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('online')}
                  className={`py-1.5 text-[0.65rem] font-medium rounded-lg transition ${
                    mode === 'online' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('cvc')}
                  className={`py-1.5 text-[0.65rem] font-medium rounded-lg transition ${
                    mode === 'cvc' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  AI vs AI
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('cvc_turbo')}
                  className={`py-1.5 text-[0.65rem] font-medium rounded-lg transition ${
                    mode === 'cvc_turbo' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
                  }`}
                >
                  AI vs AI Turbo <span className="text-amber-500" style={{ fontSize: '0.95rem', lineHeight: 0 }}>⚡</span>
                </button>
              </div>
              {mode !== 'online' && (
                <div className="flex justify-end">
                  <Button onClick={resetLocal} variant="outline" size="sm">
                    Reset Game
                  </Button>
                </div>
              )}
            </div>
            {state ? (
              <>
                {mode !== 'online' && timeControl !== 'unlimited' && (
                  <ClockBar
                    whiteClock={whiteClock}
                    blackClock={blackClock}
                    active={gameOver ? null : turn}
                    flipped={effectiveFlipped}
                  />
                )}
                <CapturedRow pieces={viewCaptured.w} label="White has captured" />
                <div className="my-3 w-full flex justify-center">
                  <div className="relative w-full max-w-[620px]">
                    <ChessBoard
                      board={viewState.board}
                      selected={reviewing ? null : selected}
                      legalMoves={reviewing ? [] : legalMoves}
                      lastMove={viewLastMove}
                      onSquareClick={handleSquareClick}
                      onDropMove={handleDropMove}
                      animateMove={animateMove}
                      flipped={effectiveFlipped}
                      checkSquare={viewCheck}
                      hintMove={reviewing ? null : hint}
                      boardTheme={boardTheme}
                      pieceStyle={pieceStyle}
                    />
                    {banner && <GameOverBanner title={banner.title} subtitle={banner.subtitle} />}
                  </div>
                </div>
                <CapturedRow pieces={viewCaptured.b} label="Black has captured" />
                <div className="w-full max-w-[620px] mx-auto mt-1 flex items-center justify-between gap-3">
                  <p
                    className={`text-base font-medium ${
                      status === 'checkmate' ? 'text-rose-600' : 'text-stone-800'
                    }`}
                  >
                    {statusText}
                  </p>
                  <Button
                    size="sm"
                    variant={soundOn ? 'default' : 'outline'}
                    onClick={() => setSoundOn((s) => !s)}
                  >
                    {soundOn ? 'Sound On' : 'Sound Off'}
                  </Button>
                </div>
                <div className="w-full max-w-[620px] mx-auto mt-2">
                  <ThemePicker
                    boardTheme={boardTheme}
                    pieceStyle={pieceStyle}
                    onBoardTheme={setBoardTheme}
                    onPieceStyle={setPieceStyle}
                  />
                </div>
                <CheckmateEstimate />
                <MoveHistory sans={moveSanDisplay} />
                {moveSanDisplay.length > 0 && (
                  <ShareMoves sans={moveSanDisplay} resultStr={resultStr} />
                )}
                {gameOver && positionList.length > 1 && (
                  <ReplayBar
                    index={reviewIdx}
                    total={positionList.length}
                    onFirst={() => setReviewIdx(0)}
                    onPrev={() =>
                      setReviewIdx((i) => (i === null ? positionList.length - 2 : Math.max(0, i - 1)))
                    }
                    onNext={() =>
                      setReviewIdx((i) => (i === null ? null : Math.min(positionList.length - 1, i + 1)))
                    }
                    onLast={() => setReviewIdx(positionList.length - 1)}
                    onLive={() => setReviewIdx(null)}
                  />
                )}
              </>
            ) : (
              <div className="w-full max-w-[620px] aspect-[10/9] rounded-2xl bg-white/60 ring-1 ring-stone-200 flex items-center justify-center text-stone-400 text-sm text-center px-6">
                Create or join an online game to start playing
              </div>
            )}
          </div>

          <aside className="space-y-5">
            {/* Game controls (all modes) */}
            <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-stone-400">Game</span>
                <span className="text-xs font-medium text-amber-600">
                  {isPro ? '⚡ Pro' : ''}
                </span>
              </div>
              {!isPro && canUpgrade && (
                <button
                  type="button"
                  onClick={() => setShowPro(true)}
                  className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium py-2 shadow-sm hover:from-amber-600 hover:to-amber-700 transition"
                >
                  ⚡ Upgrade to Pro
                </button>
              )}
              {mode !== 'online' && (
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1">Time control</p>
                  <select
                    value={timeControl}
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="w-full text-sm rounded-lg border border-stone-200 bg-white px-2 py-1.5"
                  >
                    {Object.keys(TIME_CONTROLS).map((k) => (
                      <option key={k} value={k}>
                        {TIME_CONTROLS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => setFlipped((f) => !f)}>
                  Flip board
                </Button>
                {mode === 'local' && (
                  <Button
                    size="sm"
                    variant={autoFlip ? 'default' : 'outline'}
                    onClick={() => setAutoFlip((a) => !a)}
                  >
                    Auto-flip
                  </Button>
                )}
                {humanToMove && (
                  <Button size="sm" variant="outline" onClick={showHint} disabled={hintLoading}>
                    {hintLoading ? 'Thinking…' : 'Hint'}
                  </Button>
                )}
                {(mode === 'local' || mode === 'computer') && !gameOver && (
                  <Button size="sm" variant="outline" onClick={resign}>
                    Resign
                  </Button>
                )}
                {mode === 'local' && !gameOver && (
                  <Button size="sm" variant="outline" onClick={offerDraw}>
                    Draw
                  </Button>
                )}
              </div>
            </div>

            {(showDifficulty || mode === 'computer') && (
              <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
                {showDifficulty && (
                  <div className={mode === 'computer' ? 'mb-4' : ''}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs uppercase tracking-widest text-stone-400">Difficulty</p>
                      <span className="text-xs font-semibold text-stone-700">
                        Level {difficulty}/{isPro ? 8 : 3}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={isPro ? 8 : 3}
                      step={1}
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      className="w-full accent-amber-600"
                    />
                    {!isPro && canUpgrade && (
                      <button
                        type="button"
                        onClick={() => setShowPro(true)}
                        className="mt-1 text-[0.7rem] text-amber-600 hover:underline"
                      >
                        🔒 Levels 4–8 are Pro — upgrade
                      </button>
                    )}
                  </div>
                )}
                {mode === 'computer' && (
                  <Button
                    onClick={undo}
                    variant="outline"
                    className="w-full"
                    disabled={thinking || history.length < 2 || gameOver || promo}
                  >
                    Undo
                  </Button>
                )}
              </div>
            )}

            {mode === 'online' && (
              <OnlinePanel
                onlineGame={onlineGame}
                myColor={myColor}
                myId={me?.id}
                openGames={openGames}
                activeGames={activeGames}
                spectator={spectator}
                statusText={statusText}
                onlineError={onlineError}
                onQuickMatch={quickMatch}
                onCreate={createOnline}
                onJoinCode={joinOnline}
                onJoinGame={joinSpecific}
                onReenterOwn={reenterOwn}
                onStartGhost={startGhost}
                onWatch={watchGame}
                onLeave={leaveOnline}
                onResign={resignOnline}
                onOfferDraw={offerDrawOnline}
                onAcceptDraw={acceptDrawOnline}
                onDeclineDraw={declineDrawOnline}
              />
            )}

            {mode !== 'online' && (
              <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">How to play</p>
                <ul className="space-y-2 text-sm text-stone-600 leading-relaxed">
                  <li>• Tap a piece to see its legal moves, then tap a highlighted square to move.</li>
                  <li>• Standard chess rules apply on a 10-wide, 9-rank board, including castling and en passant.</li>
                  <li>
                    • <span className="font-medium text-stone-800">Truth</span> (the † cross piece) moves like a
                    Queen. It captures only the opposing Truth, and can be captured only by the opposing King
                    or an opposing Truth — otherwise it acts as a passive blocker. It controls the squares it
                    slides to, so it can deliver check and checkmate.
                  </li>
                  <li>• Pawns reaching the last rank promote (choose Q, R, B, or N).</li>
                  <li>• Draws are detected automatically at threefold repetition and the 50-move rule; use <span className="font-medium text-stone-800">Draw</span> to agree a draw, <span className="font-medium text-stone-800">Hint</span> for a suggested move, and <span className="font-medium text-stone-800">Copy moves</span> to export the game, or <span className="font-medium text-stone-800">Email moves</span> to send it to yourself.</li>
                </ul>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-8 space-y-6">
          {me && <StatsPanel userId={me.id} />}
          <Leaderboard />
        </div>
      </div>

      {showPro && canUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-lg font-semibold text-stone-800">⚡ Truth Chess Pro</p>
              <button
                type="button"
                onClick={() => setShowPro(false)}
                className="text-stone-400 hover:text-stone-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <ul className="space-y-2 text-sm text-stone-600 mb-4">
              <li>• Unlock AI levels 4–8 for stronger play</li>
              <li>• Unlimited online games (free: 3/day)</li>
              <li>• Support ongoing development</li>
            </ul>
            <p className="text-sm font-medium text-stone-800 mb-3">$2.99/month · cancel anytime</p>
            <Button onClick={upgrade} disabled={upgrading} className="w-full">
              {upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
            </Button>
            <p className="text-[0.65rem] text-stone-400 text-center mt-2">
              Payment processed securely by Base44 Payments.
            </p>
          </div>
        </div>
      )}

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