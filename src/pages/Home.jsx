import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import ChessBoard from '@/components/ChessBoard';
import { Link, useLocation } from 'react-router-dom';
import {
  initialState,
  legalMovesFor,
  allLegalMoves,
  gameStatus,
  makeMove,
  findKing,
  positionKey,
  setVariant,
} from '@/lib/chessVariant';

// Hidden "Maiden" variant: activated via ?maiden=1 in the URL. Adds a Maiden
// piece (M) to the four corner pawn squares (a2/j2/a8/j8). She moves one square
// any direction, captures only the opposing Truth, and is captured only by the
// opposing Truth. Off by default — no UI exposes it yet.
const _MAIDEN_MODE = (() => {
  try {
    return new URLSearchParams(window.location.search).get('maiden') === '1';
  } catch {
    return false;
  }
})();
if (_MAIDEN_MODE) setVariant('maiden');
if (_MAIDEN_MODE) { document.title = 'Truth Chess Maiden Mode'; }
import { bestMove, DIFFICULTIES } from '@/lib/chessAI';
import {
  rollOpeningTarget,
  recordMate,
  updateAggression,
  syncMateBookFromServer,
  syncLearnedPositionsFromServer,
  recordGameResult,
  tuneEvalWeights,
} from '@/lib/aiLearning';
import { generateCode, replayGame, replayStates, serializeMove } from '@/lib/onlineGame';
import { randomOpening, bookMove } from '@/lib/openings';
import { movesToSAN, classifyMove, hasThreefold, toPGN } from '@/lib/chessNotation';
import { useChessSounds } from '@/hooks/useChessSounds';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import OnlinePanel from '@/components/OnlinePanel';
import SpectatePanel from '@/components/SpectatePanel';
import Leaderboard from '@/components/Leaderboard';
import MoveHistory from '@/components/MoveHistory';
import ReplayBar from '@/components/ReplayBar';
import ClockBar from '@/components/ClockBar';
import StatsPanel from '@/components/StatsPanel';
import { isMobileApp } from '@/lib/isMobileApp';
import CheckmateEstimate from '@/components/CheckmateEstimate';
import ShareMoves from '@/components/ShareMoves';
import GameOverBanner from '@/components/GameOverBanner';
import ResignFlowBanner from '@/components/ResignFlowBanner';
import LobbyPanel from '@/components/LobbyPanel';
import PlayerNameCard from '@/components/PlayerNameCard';
import { usePresence } from '@/hooks/usePresence';
import { Users, Computer, Globe, Bot, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import CapturedSide from '@/components/CapturedSide';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', T: '♚' };

// Game modes. Pro-only modes are gated behind the upgrade prompt on web and
// hidden on mobile (where Pro can't be purchased). vs Computer and AI vs AI
// are always free.
const MODES = [
  { key: 'online', label: 'Online', pro: true, Icon: Globe, active: 'bg-violet-100 text-violet-700 ring-violet-300', icon: 'text-violet-500' },
  { key: 'computer', label: 'vs Computer', pro: false, Icon: Computer, active: 'bg-emerald-100 text-emerald-700 ring-emerald-300', icon: 'text-emerald-500' },
  { key: 'local', label: '2 Players', pro: true, Icon: Users, active: 'bg-sky-100 text-sky-700 ring-sky-300', icon: 'text-sky-500' },
  { key: 'cvc_turbo', label: 'AI vs AI', pro: false, turbo: true, Icon: Bot, active: 'bg-amber-100 text-amber-700 ring-amber-300', icon: 'text-amber-500' },
];

const TIME_CONTROLS = {
  '30+0': { label: '30 min', initial: 1800, inc: 0 },
  '3+2': { label: '3+2 Blitz', initial: 180, inc: 2 },
  '5+0': { label: '5+0 Bullet', initial: 300, inc: 0 },
  '10+0': { label: '10+0 Rapid', initial: 600, inc: 0 },
  '15+10': { label: '15+10', initial: 900, inc: 10 },
};

// Free trial: every new player gets all modes for their first 55 games, then
// the Pro paywall applies.
const TRIAL_GAMES = 55;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

// AI vs AI auto-resign trigger: a side reduced to only a king while the
// opponent holds any piece at all (bishop, knight, pawn, Truth, rook, or
// queen) is a lost cause — the lone-king side offers to resign so spectators
// don't watch the 50-move rule grind out.
function loneKingLoser(state) {
  let wAll = 0, bAll = 0;
  for (let r = 0; r < 9; r++) {
    for (let f = 0; f < 10; f++) {
      const p = state.board[r][f];
      if (!p || p.type === 'K') continue;
      if (p.color === 'w') wAll++;
      else bAll++;
    }
  }
  if (wAll === 0 && bAll >= 1) return 'w';
  if (bAll === 0 && wAll >= 1) return 'b';
  return null;
}

export default function Home() {
  const [mode, setMode] = useState('computer'); // 'local' | 'computer' | 'online'
  // Hidden Maiden variant — see _MAIDEN_MODE above. Derived live from the URL
  // each render so the title/promo UI and the board reset react even when the
  // mode is reached via in-app navigation (where the module-level const was
  // already evaluated without the param).
  const location = useLocation();
  const maidenMode = (() => {
    try { return new URLSearchParams(location.search).get('maiden') === '1'; }
    catch { return false; }
  })();

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
  const dailyStatRef = useRef(false);
  const kingOnlySinceRef = useRef(null);
  const computerGameRef = useRef(null);
  const computerBroadcastRef = useRef({ queue: [], gameOver: false, status: 'playing', turn: 'w', processing: false });
  // Refs mirror the current online game/color so unmount/beforeunload cleanup
  // can forfeit an active game when the player leaves the page.
  const onlineGameRef = useRef(null);
  const myColorRef = useRef(null);

  // batch-1 additions
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [hint, setHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [startMs, setStartMs] = useState(Date.now());
  const prevMovesLen = useRef(0);
  const playSound = useChessSounds(soundOn);
  const { toast } = useToast();

  // batch-2 additions
  const [localMoves, setLocalMoves] = useState([]);
  const [drawAgreed, setDrawAgreed] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [timeControl, setTimeControl] = useState('30+0');
  const [whiteClock, setWhiteClock] = useState(TIME_CONTROLS['30+0'].initial);
  const [blackClock, setBlackClock] = useState(TIME_CONTROLS['30+0'].initial);
  const [timedOut, setTimedOut] = useState(null);
  const [animateMove, setAnimateMove] = useState(null);
  const [showPro, setShowPro] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [started, setStarted] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  // AI vs AI agreed resignation: a lone-king side offers to resign and the
  // opponent accepts, shown to the spectator so they don't sit through a dead
  // 50-move grind. `autoResign` drives the visible offer→accept flow;
  // `cvcResignResult` ends the game.
  const [autoResign, setAutoResign] = useState(null);
  const [cvcResignResult, setCvcResignResult] = useState(null);
  // vs Computer: the human's color for the current game. Default White; a
  // player who wins as Black earns White for the next game (traditional chess).
  const [playerColor, setPlayerColor] = useState('w');
  const wonAsBlackRef = useRef(false);
  const computerColor = playerColor === 'w' ? 'b' : 'w';

  // online
  const [me, setMe] = useState(null);
  const [onlineGame, setOnlineGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [openGames, setOpenGames] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [ghostOpponent, setGhostOpponent] = useState(false);
  const [spectator, setSpectator] = useState(false);
  // vs-Computer games broadcast to the live-games list so other devices can
  // spectate them, just like online games.
  const [computerGame, setComputerGame] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then((u) => { setMe(u); })
      .catch(() => { setMe(null); });
  }, []);

  // Activate the hidden Maiden variant on mount (covers in-app navigation,
  // where the module-level setVariant already ran with the param absent).
  // resetLocal() re-creates localMoves with a fresh reference so the
  // positionList memo recomputes against the now-Maiden initial state.
  useEffect(() => {
    setVariant(maidenMode ? 'maiden' : 'classic');
    resetLocal();
    document.title = maidenMode ? 'Truth Chess Maiden Mode' : 'Truth Chess';
  }, [maidenMode]);

  // Stable identity for online play: registered users use their account;
  // guests (not signed in) get a stable localStorage id and show as Anonymous.
  const guestIdRef = useRef(null);
  if (!guestIdRef.current) {
    let g = null;
    try { g = localStorage.getItem('tc_guest_id'); } catch (e) {}
    if (!g) {
      g = 'guest_' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem('tc_guest_id', g); } catch (e) {}
    }
    guestIdRef.current = g;
  }
  // Stable random 9-digit tag appended to guest display names in the lobby,
  // so each anonymous visitor is distinguishable (e.g. "Anonymous482913075").
  const guestTagRef = useRef(null);
  if (guestTagRef.current === null) {
    let tag = null;
    try { tag = localStorage.getItem('tc_guest_tag'); } catch (e) {}
    if (!tag) {
      tag = String(Math.floor(100000000 + Math.random() * 900000000));
      try { localStorage.setItem('tc_guest_tag', tag); } catch (e) {}
    }
    guestTagRef.current = tag;
  }
  const identity = useMemo(() => {
    if (me) {
      const name = me.player_name || me.data?.player_name || '';
      return { id: me.id, player_name: name, is_guest: false };
    }
    return { id: guestIdRef.current, player_name: `Anonymous${guestTagRef.current}`, is_guest: true };
  }, [me]);
  const online = usePresence(identity);

  // Persist a chosen player name on the user's account (registered only).
  async function savePlayerName(name) {
    try {
      await base44.auth.updateMe({ player_name: name });
      setMe((m) => (m ? { ...m, player_name: name } : m));
      toast({ title: 'Player name saved' });
    } catch (e) {
      toast({ title: 'Could not save name', description: 'Please try again.' });
    }
  }

  // Load the shared, server-backed mate book so the AI recalls checkmates
  // learned in any mode, any session, on any device.
  useEffect(() => {
    syncMateBookFromServer();
    syncLearnedPositionsFromServer();
    refreshOpenGames();
  }, []);

  // Global live-games refresh: any Game change (a vs-Computer game starting,
  // an online move, a game finishing) re-fetches the open/active lists so the
  // lobby and "watch live games" panel stay current on every device, not just
  // the one playing online.
  useEffect(() => {
    const unsub = base44.entities.Game.subscribe(() => {
      refreshOpenGames();
    });
    return () => { if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Truth Chess is free for everyone — no paywall. All modes and AI levels are open.
  const hasAccess = true;
  const canUpgrade = false;
  const visibleModes = MODES;

  const onlineDerived = useMemo(() => {
    if (mode !== 'online' || !onlineGame) return null;
    return replayGame(onlineGame.moves);
  }, [mode, onlineGame]);

  const myColor = useMemo(() => {
    if (!onlineGame || !identity?.id) return null;
    if (onlineGame.white_player_id === identity.id) return 'w';
    if (onlineGame.black_player_id === identity.id) return 'b';
    return null;
  }, [onlineGame, identity?.id]);

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

  const localOver = mode !== 'online' && (resigned || drawAgreed || !!timedOut || !!cvcResignResult);
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
    return (playerColor === 'b') !== flipped; // computer
  }, [mode, autoFlip, turn, flipped, myColor, playerColor]);

  const humanToMove = useMemo(() => {
    if (!state || gameOver || resigned || drawAgreed || submitting || promo || reviewing) return false;
    if (mode === 'local') return started;
    if (mode === 'computer') return started && turn === playerColor;
    if (mode === 'online') return onlineGame?.status === 'active' && !!myColor && turn === myColor;
    return false;
  }, [state, gameOver, resigned, drawAgreed, submitting, promo, reviewing, mode, turn, myColor, onlineGame?.status, started, playerColor]);

  const resultStr = useMemo(() => {
    if (mode === 'online' && onlineGame) {
      if (!onlineGame.result) return '*';
      return onlineGame.result === 'white_wins'
        ? '1-0'
        : onlineGame.result === 'black_wins'
        ? '0-1'
        : '1/2-1/2';
    }
    if (cvcResignResult) return cvcResignResult === 'white_resigns' ? '0-1' : '1-0';
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
    if (mode === 'computer' && turn === computerColor) return;
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
    if (mode === 'computer' && turn === computerColor) return;
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
    if (timeControl !== '30+0') {
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
    if (mode === 'online') {
      offerDrawOnline();
      return;
    }
    if ((mode !== 'local' && mode !== 'computer') || gameOver) return;
    setDrawAgreed(true);
    playSound('mate');
  }

  function showHint() {
    if (!humanToMove || hintLoading) return;
    setHintLoading(true);
    setTimeout(() => {
      const ctx = { positionKeys: positionList.map((p) => positionKey(p.state)) };
      const m = bestMove(state, turn, 5, false, ctx);
      setHint(m);
      setHintLoading(false);
    }, 30);
  }

  function startGame() {
    setStarted(true);
    setStartMs(Date.now());
    setElapsed(0);
  }

  function resetLocal() {
    if (wonAsBlackRef.current) {
      setPlayerColor('w');
      wonAsBlackRef.current = false;
    }
    cleanupComputerBroadcast();
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
    setStarted(false);
    setAutoResign(null);
    setCvcResignResult(null);
    const tc = TIME_CONTROLS[timeControl];
    setWhiteClock(tc.initial);
    setBlackClock(tc.initial);
    setStartMs(Date.now());
    setElapsed(0);
    openingRef.current = { book: null, wTarget: null, bTarget: null };
    recordedRef.current = false;
    kingOnlySinceRef.current = null;
  }

  // In online mode, "Reset game" leaves the current match and immediately
  // matchmakes a fresh one.
  async function resetOnline() {
    await leaveOnline();
    quickMatch();
  }

  function changeMode(m) {
    leaveOnline();
    setMode(m);
    resetLocal();
  }

  // Selecting a Pro-only mode as a non-Pro user opens the upgrade prompt (web)
  // instead of switching. On mobile, where Pro can't be purchased, gated modes
  // are hidden from the selector entirely.
  function guardedChangeMode(m) {
    if (MODES.find((x) => x.key === m)?.pro && !hasAccess) {
      if (canUpgrade) setShowPro(true);
      return;
    }
    // Don't restart an in-progress local/computer/AI-vs-AI game when its mode
    // button is tapped — let the current game finish first, then the button
    // starts a fresh one. The Reset button is the explicit restart.
    if (m !== 'online' && started && !gameOver) {
      toast({ title: 'Game in progress', description: 'Finish it (or press Reset) to start a new one.' });
      return;
    }
    if (m === 'online') {
      // Already in an active game — no need to re-matchmake.
      if (mode === 'online' && onlineGame?.status === 'active') return;
      leaveOnline();
      setMode('online');
      resetLocal();
      // Go straight into matchmaking so the board appears immediately.
      quickMatch();
      return;
    }
    changeMode(m);
  }

  // --- online operations -------------------------------------------------
  // Online play is a Pro feature. Free users are prompted to upgrade (web) or
  // see a locked message (mobile, where Pro can't be purchased).
  function requirePro() {
    if (hasAccess) return true;
    setOnlineError(canUpgrade ? 'Pro feature — upgrade to unlock.' : 'Pro feature.');
    if (canUpgrade) setShowPro(true);
    return false;
  }

  async function createOnline() {
    setOnlineError('');
    try {
      if (!requirePro()) return;
      const code = generateCode();
      const rec = await base44.entities.Game.create({
        code,
        status: 'waiting',
        host_color: 'w',
        white_player_id: identity.id,
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
      if (!requirePro()) return;
      const found = await base44.entities.Game.filter({
        code: code.toUpperCase(),
        status: 'waiting',
      });
      if (!found || found.length === 0) {
        setOnlineError('No open game with that code.');
        return;
      }
      const g = found[0];
      if (g.white_player_id === identity.id) {
        setOnlineError('That is your own game — waiting for an opponent.');
        prevMovesLen.current = g.moves?.length || 0;
        setOnlineGame(g);
        return;
      }
      const updated = await base44.entities.Game.update(g.id, {
        black_player_id: identity.id,
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
      } else if (onlineGame.status === 'waiting' && onlineGame.white_player_id === identity?.id) {
        try {
          await base44.entities.Game.delete(onlineGame.id);
        } catch {
          // ignore
        }
      } else if (onlineGame.status === 'active' && myColor) {
        // Leaving an active online game is an immediate forfeit — the opponent
        // wins and the game is purged from the lobby so it can't linger.
        try {
          const winner = myColor === 'w' ? 'black_wins' : 'white_wins';
          await base44.entities.Game.update(onlineGame.id, {
            status: 'finished',
            result: winner,
          });
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

  async function donate() {
    setUpgrading(true);
    try {
      const res = await base44.functions.invoke('create-checkout', { productId: 'donation' });
      if (res?.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
    } catch {
      // ignore
    }
    setUpgrading(false);
    toast({ title: 'Could not start donation', description: 'Please try again later.' });
  }

  // Email the finished game: capture the final board as an image, upload it,
  // and send an HTML email (via the email-game backend function) with the
  // board picture and a readable move list. Falls back to the user's own mail
  // client (with the moves + an image link) if the direct send fails.
  async function emailMoves() {
    if (sendingEmail) return;
    setSendingEmail(true);
    const prevReview = reviewIdx;
    if (prevReview !== null) setReviewIdx(null);
    await new Promise((r) => setTimeout(r, 80));

    let imageUrl = null;
    try {
      const grid = document.querySelector('.grid');
      if (grid) {
        const canvas = await html2canvas(grid, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
        });
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `truth-chess-${Date.now()}.png`, { type: 'image/png' });
        const res = await base44.integrations.Core.UploadFile({ file });
        imageUrl = res?.file_url || null;
      }
    } catch (e) {
      imageUrl = null;
    }

    if (prevReview !== null) setReviewIdx(prevReview);

    // SendEmail only reaches registered app users (without a connected custom
    // domain). To avoid spending an integration credit on a send that is
    // guaranteed to fail, guests and any address we can't confirm is
    // registered skip the platform email entirely and open their own mail
    // client instead. Registered users sending to their own address still get
    // the direct email (1 credit, intended use).
    const ownEmail = me && me.email ? me.email : null;

    if (ownEmail) {
      try {
        await base44.functions.invoke('email-game', { to: ownEmail, sans: moveSanDisplay, resultStr, imageUrl });
        toast({ title: 'Game emailed!', description: 'Check your inbox for the board image and moves.' });
        setSendingEmail(false);
        return;
      } catch (e) {
        // direct send failed — fall through to the mail-app fallback
      }
    }

    const to = ownEmail || window.prompt('Enter the email address to send your game to:');
    if (!to) { setSendingEmail(false); return; }
    const pgn = toPGN(moveSanDisplay, resultStr || '*');
    const body = imageUrl ? `${pgn}\n\nView the final board: ${imageUrl}` : pgn;
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('My Truth Chess Game')}&body=${encodeURIComponent(body)}`;
    toast({ title: 'Opened your mail app', description: 'Your moves and board link are ready to send.' });
    setSendingEmail(false);
  }

  async function refreshOpenGames() {
    try {
      const [waiting, active] = await Promise.all([
        base44.entities.Game.filter({ status: 'waiting' }, 'created_date', 50),
        base44.entities.Game.filter({ status: 'active' }, 'created_date', 50),
      ]);
      // Prune waiting games whose creator has gone away: if no one has joined
      // within 10 minutes (last_move_at set at creation), the host likely closed
      // their browser — delete the stale record so it stops showing in the
      // lobby. Avoid deleting the game this client is currently waiting in.
      const cutoff = Date.now() - 10 * 60 * 1000;
      const stale = (waiting || []).filter((g) => {
        if (onlineGame && g.id === onlineGame.id) return false;
        const ts = g.last_move_at ? Date.parse(g.last_move_at) : Date.parse(g.created_date);
        return !isNaN(ts) && ts < cutoff;
      });
      if (stale.length) {
        await Promise.all(stale.map((g) => base44.entities.Game.delete(g.id).catch(() => {})));
      }
      const liveWaiting = (waiting || []).filter((g) => !stale.find((s) => s.id === g.id));
      setOpenGames(liveWaiting);
      // Prune any active game that's been abandoned — no move activity for 30
      // minutes means no one is playing it (a closed tab, a dropped connection,
      // a vs-Computer game left mid-match). This catches both zero-move games
      // that never started and games with moves whose player walked away, so
      // the "watch live games" list only shows games someone is actually
      // playing. Skip the game this client is currently in.
      const activeCutoff = Date.now() - 30 * 60 * 1000;
      const staleActive = (active || []).filter((g) => {
        if (onlineGame && g.id === onlineGame.id) return false;
        if (computerGameRef.current && g.id === computerGameRef.current.id) return false;
        const ts = g.last_move_at ? Date.parse(g.last_move_at) : Date.parse(g.created_date);
        return !isNaN(ts) && ts < activeCutoff;
      });
      if (staleActive.length) {
        await Promise.all(staleActive.map((g) => base44.entities.Game.delete(g.id).catch(() => {})));
      }
      const liveActive = (active || []).filter((g) => !staleActive.find((s) => s.id === g.id));
      setActiveGames(liveActive);
    } catch {
      // ignore
    }
  }

  async function quickMatch() {
    setOnlineError('');
    if (!requirePro()) return;
    try {
      const open = await base44.entities.Game.filter({ status: 'waiting' }, 'created_date', 50);
      const joinable = (open || []).find(
        (g) => g.white_player_id !== identity.id && !g.black_player_id
      );
      if (joinable) {
        const updated = await base44.entities.Game.update(joinable.id, {
          black_player_id: identity.id,
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
    if (game.white_player_id === identity.id) {
      setOnlineError('That is your own game.');
      return;
    }
    try {
      const updated = await base44.entities.Game.update(game.id, {
        black_player_id: identity.id,
        status: 'active',
        last_move_at: new Date().toISOString(),
      });
      prevMovesLen.current = 0;
      setMode('online');
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
    setMode('online');
    setSpectator(true);
    setGhostOpponent(false);
    prevMovesLen.current = game.moves?.length || 0;
    setOnlineGame(game);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function startGhost() {
    setOnlineError('');
    if (!requirePro()) return;
    try {
      const code = generateCode();
      const rec = await base44.entities.Game.create({
        code,
        status: 'active',
        host_color: 'w',
        white_player_id: identity.id,
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

  // --- vs-Computer broadcast --------------------------------------------
  // Mirrors the local vs-Computer game into a Game record (black = '__computer__')
  // so it shows up in the live-games list and can be spectated from other
  // devices. The record is created on the first move and kept in sync as moves
  // are made; it's deleted when the game is reset, the mode changes, or the
  // page unmounts so finished/abandoned computer games don't accumulate.
  async function processComputerBroadcast() {
    const ref = computerBroadcastRef.current;
    if (ref.processing) return;
    ref.processing = true;
    try {
      // Loop so a move that arrives mid-flight gets synced too.
      while (true) {
        const moves = ref.queue;
        if (!moves || moves.length === 0) break;
        const id = computerGameRef.current?.id;
        const payload = {
          moves,
          last_move_at: new Date().toISOString(),
          status: ref.gameOver ? 'finished' : 'active',
          result: ref.gameOver
            ? ref.status === 'checkmate'
              ? ref.turn === 'w' ? 'black_wins' : 'white_wins'
              : 'draw'
            : null,
        };
        try {
          if (!id) {
            const playerIsWhite = playerColor === 'w';
            const rec = await base44.entities.Game.create({
              code: generateCode(),
              host_color: playerColor,
              white_player_id: playerIsWhite ? identity.id : '__computer__',
              black_player_id: playerIsWhite ? '__computer__' : identity.id,
              ...payload,
            });
            computerGameRef.current = rec;
            setComputerGame(rec);
          } else {
            const updated = await base44.entities.Game.update(id, payload);
            computerGameRef.current = updated;
            setComputerGame(updated);
          }
        } catch {
          // ignore transient failures
        }
        if (ref.queue === moves) break;
      }
    } finally {
      ref.processing = false;
    }
  }

  async function cleanupComputerBroadcast() {
    const g = computerGameRef.current;
    computerGameRef.current = null;
    setComputerGame(null);
    computerBroadcastRef.current.queue = [];
    if (g) {
      try { await base44.entities.Game.delete(g.id); } catch { /* ignore */ }
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

  // vs-Computer broadcast trigger: whenever the local move list changes in
  // computer mode, push the latest position to the server.
  useEffect(() => {
    if (mode !== 'computer') return;
    computerBroadcastRef.current.queue = localMoves;
    computerBroadcastRef.current.gameOver = gameOver;
    computerBroadcastRef.current.status = status;
    computerBroadcastRef.current.turn = turn;
    if (localMoves.length === 0) return;
    processComputerBroadcast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, localMoves, gameOver, status, turn]);

  // Keep refs of the current online game and color in sync so unmount and
  // beforeunload cleanup can forfeit an active game when the player leaves.
  useEffect(() => { onlineGameRef.current = onlineGame; }, [onlineGame]);
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  // Forfeit an active online game and delete the vs-Computer broadcast
  // record if the player closes the tab outright — otherwise both linger as
  // "active" games no one is playing.
  useEffect(() => {
    function onBeforeUnload() {
      const cg = computerGameRef.current;
      if (cg) base44.entities.Game.delete(cg.id).catch(() => {});
      const g = onlineGameRef.current;
      const mc = myColorRef.current;
      if (!g || g.status !== 'active' || !mc) return;
      const winner = mc === 'w' ? 'black_wins' : 'white_wins';
      base44.entities.Game.update(g.id, { status: 'finished', result: winner }).catch(() => {});
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Delete the vs-Computer broadcast record and forfeit any active online
  // game when the page unmounts (route navigation) so neither lingers as an
  // "active" game no one is playing.
  useEffect(() => {
    return () => {
      const g = computerGameRef.current;
      if (g) {
        base44.entities.Game.delete(g.id).catch(() => {});
      }
      const og = onlineGameRef.current;
      const mc = myColorRef.current;
      if (og && og.status === 'active' && mc) {
        const winner = mc === 'w' ? 'black_wins' : 'white_wins';
        base44.entities.Game.update(og.id, { status: 'finished', result: winner }).catch(() => {});
      }
    };
  }, []);

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
    const useElapsed = mode === 'online';
    const active = mode === 'online' ? onlineGame?.status === 'active' && !gameOver : !gameOver;
    if (!useElapsed || !active) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, gameOver, mode, onlineGame?.status, timeControl]);

  // per-side countdown clocks (local & computer, timed control)
  useEffect(() => {
    if (mode === 'online' || gameOver || !started) return undefined;
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
  }, [mode, gameOver, timeControl, turn, started]);

  // flag on time out
  useEffect(() => {
    if (mode === 'online' || gameOver || timedOut) return;
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
    if (mode !== 'computer' || turn !== computerColor || gameOver || promo || !started) return;
    if (!openingRef.current.book) {
      openingRef.current = {
        book: randomOpening(),
        wTarget: computerColor === 'w' ? rollOpeningTarget('w', localState.board) : null,
        bTarget: computerColor === 'b' ? rollOpeningTarget('b', localState.board) : null,
      };
    }
    setThinking(true);
    const t = setTimeout(() => {
      const legal = allLegalMoves(localState, computerColor);
      const sideTarget = computerColor === 'w' ? openingRef.current.wTarget : openingRef.current.bTarget;
      const scripted = sideTarget
        ? null
        : bookMove(openingRef.current.book, localMoves.length, legal, computerColor);
      let move;
      if (scripted) move = scripted;
      else {
        const ctx = {
          ply: localMoves.length,
          wTarget: openingRef.current.wTarget ? openingRef.current.wTarget.type : null,
          bTarget: openingRef.current.bTarget ? openingRef.current.bTarget.type : null,
          positionKeys: positionList.map((p) => positionKey(p.state)),
        };
        move = bestMove(localState, computerColor, difficulty, false, ctx);
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
  }, [mode, gameOver, promo, localState, difficulty, turn, localMoves, started, computerColor]);

  // computer vs computer: each side opens with a randomly chosen traditional
  // opening (one of twenty-three), then auto-plays at level 6 — aggressively
  // pursuing checkmate and never allowing threefold repetition. Move cadence
  // varies slightly (0.91 / 1.5 / 2 s) so the rhythm feels natural.
  useEffect(() => {
    if ((mode !== 'cvc' && mode !== 'cvc_turbo') || gameOver || promo || !started || autoResign) return;
    // Auto-resign: if the side to move has only a king and the opponent has at
    // least 2 real pieces, the lone-king side offers to resign instead of
    // moving. The visible offer→accept flow is driven by the effect below.
    const resignLoser = loneKingLoser(localState);
    if (resignLoser && localState.turn === resignLoser) {
      setAutoResign({ loser: resignLoser, phase: 'offer' });
      return;
    }
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
          positionKeys: positionList.map((p) => positionKey(p.state)),
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
  }, [mode, gameOver, promo, localState, turn, localMoves, started, autoResign]);

  // AI vs AI agreed-resignation flow: show "offers to resign", then "accepts",
  // then end the game so the spectator sees both steps before the result.
  useEffect(() => {
    if (!autoResign) return undefined;
    if (autoResign.phase === 'offer') {
      const t = setTimeout(() => setAutoResign((a) => (a ? { ...a, phase: 'accepted' } : a)), 1600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setCvcResignResult(autoResign.loser === 'w' ? 'white_resigns' : 'black_resigns');
      setAutoResign(null);
    }, 1300);
    return () => clearTimeout(t);
  }, [autoResign]);

  // ghost opponent: AI plays the other side over the online channel (test mode)
  useEffect(() => {
    if (mode !== 'online' || !ghostOpponent || !onlineGame || onlineGame.status !== 'active') return;
    if (!state || gameOver || submitting || promo) return;
    if (turn === myColor) return;
    setThinking(true);
    const t = setTimeout(() => {
      const ctx = { positionKeys: positionList.map((p) => positionKey(p.state)) };
      const move = bestMove(state, turn, difficulty, false, ctx);
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
    if (mode === 'computer' && status === 'checkmate' && turn === computerColor && difficulty < 10) {
      setPendingAdvance(true);
    }
  }, [status, turn, mode, difficulty, computerColor]);

  // Traditional color-swap: a player who wins as Black earns White for the
  // next game. Detected at game end; applied on the next reset.
  useEffect(() => {
    if (mode !== 'computer') return;
    if (status === 'checkmate' && turn !== playerColor && playerColor === 'b') {
      wonAsBlackRef.current = true;
    }
  }, [mode, status, turn, playerColor]);

  // Checkmate learning (all modes): whenever a game ends in checkmate, record
  // the winning line into the shared, server-backed mate book so the AI can
  // recall it later — in any mode, session, or device. Adaptive aggression
  // tuning stays a self-play (AI vs AI) signal only.
  // Self-play position memory (#1/#2): record the position→move→outcome for
  // every AI-driven game so the engine's root ordering learns from its own
  // games. Eval-weight tuning (#3) and idle mate-book deepening (#5) run here
  // too; vs-Computer exhibitions feed the shared memory just like AI vs AI.
  useEffect(() => {
    if (!gameOver) {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    const isCvc = mode === 'cvc' || mode === 'cvc_turbo';
    const isAiMode = isCvc || mode === 'computer' || (mode === 'online' && ghostOpponent);
    if (status === 'checkmate') {
      recordedRef.current = true;
      recordMate(positionList);
      if (isCvc) updateAggression(localMoves.length);
      if (isAiMode) {
        const result = turn === 'w' ? 'b' : 'w';
        recordGameResult(positionList, result);
        if (isCvc || ghostOpponent) tuneEvalWeights(positionList, result);
      }
    } else if (status === 'stalemate' || status === 'fifty_move' || threefold || drawAgreed) {
      recordedRef.current = true;
      if (isCvc) updateAggression(null);
      if (isAiMode) {
        recordGameResult(positionList, 'draw');
        if (isCvc || ghostOpponent) tuneEvalWeights(positionList, 'draw');
      }
    } else if (resigned && isAiMode) {
      recordedRef.current = true;
      const result = turn === 'w' ? 'b' : 'w';
      recordGameResult(positionList, result);
    } else if (timedOut && isAiMode) {
      recordedRef.current = true;
      const result = timedOut === 'w' ? 'b' : 'w';
      recordGameResult(positionList, result);
    } else if (cvcResignResult && isCvc) {
      recordedRef.current = true;
      const result = cvcResignResult === 'white_resigns' ? 'b' : 'w';
      recordGameResult(positionList, result);
    }
  }, [mode, gameOver, status, threefold, drawAgreed, resigned, timedOut, ghostOpponent, cvcResignResult, positionList, localMoves.length, turn]);

  // Daily games-played counter: record exactly one count per game, in every
  // mode, when it ends. Spectators don't count; online games are recorded by
  // White's client only so a two-player online game isn't double-counted.
  useEffect(() => {
    const finished = gameOver || (mode === 'online' && onlineGame?.status === 'finished');
    if (!finished) { dailyStatRef.current = false; return; }
    if (dailyStatRef.current) return;
    if (mode === 'online' && spectator) return;
    if (mode === 'online' && myColor !== 'w') return;
    dailyStatRef.current = true;
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    base44.functions.invoke('record-game-played', { date }).catch(() => {});
  }, [gameOver, mode, onlineGame?.status, spectator, myColor]);

  function advance() {
    setDifficulty((d) => Math.min(10, d + 1));
    setPendingAdvance(false);
    resetLocal();
  }

  function stay() {
    setPendingAdvance(false);
  }

  let statusText;
  if (autoResign) {
    const loserName = autoResign.loser === 'w' ? 'White' : 'Black';
    const winnerName = autoResign.loser === 'w' ? 'Black' : 'White';
    statusText = autoResign.phase === 'offer'
      ? `${loserName} offers to resign`
      : `${winnerName} accepts — ${winnerName} wins`;
  } else if (!started && mode !== 'online') {
    statusText = 'Press Start to begin';
  } else if (mode === 'online' && onlineGame) {
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
    if (cvcResignResult) statusText = cvcResignResult === 'white_resigns' ? 'White resigns — Black wins' : 'Black resigns — White wins';
    else if (timedOut) statusText = `${timedOut === 'w' ? 'White' : 'Black'} loses on time`;
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
    if (cvcResignResult) return { title: cvcResignResult === 'white_resigns' ? 'White resigns' : 'Black resigns', subtitle: cvcResignResult === 'white_resigns' ? 'Black wins' : 'White wins' };
    if (status === 'checkmate') return { title: 'Checkmate', subtitle: `${turn === 'w' ? 'Black' : 'White'} wins` };
    if (status === 'stalemate') return { title: 'Stalemate', subtitle: 'Draw' };
    if (status === 'fifty_move') return { title: 'Draw', subtitle: '50-move rule' };
    if (threefold) return { title: 'Draw', subtitle: 'Threefold repetition' };
    if (drawAgreed) return { title: 'Draw', subtitle: 'By agreement' };
    return null;
  }, [status, turn, threefold, drawAgreed]);

  // The board itself, shared between the in-flow (player) layout and the
  // sticky (spectator) layout so the ChessBoard props stay in one place.
  const boardEl = (
    <div className="relative w-full max-w-[600px]">
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
        boardTheme="classic"
        pieceStyle="figurine"
      />
      {banner && <GameOverBanner title={banner.title} subtitle={banner.subtitle} />}
      {autoResign && <ResignFlowBanner loser={autoResign.loser} phase={autoResign.phase} />}
      {!started && mode !== 'online' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-stone-900/25 backdrop-blur-[1px]">
          <Button
            onClick={startGame}
            size="lg"
            className="px-8 text-base font-semibold shadow-lg"
          >
            Start
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
        {/* When spectating, pin the board to the top of the page wrapper (whose
            height is the full page) so position:sticky holds for the whole
            scroll and everything else moves beneath it. */}

        <header className="relative mb-8">
          <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-600/80">
            A Chess Variant
          </p>
          <div className="relative mt-2 flex items-center justify-center">
            <h1 className="inline-flex items-center gap-2 text-4xl sm:text-5xl font-display font-semibold tracking-tight text-stone-800">
              {maidenMode ? 'Truth Chess Maiden Mode' : 'Truth Chess'}
              <svg
                viewBox="0 0 24 24"
                className="h-[0.85em] w-[0.85em] shrink-0"
                role="img"
                aria-label="Truth piece"
              >
                <defs>
                  <linearGradient id="tcVert" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#64748b" />
                    <stop offset="0.5" stopColor="#0f172a" />
                    <stop offset="1" stopColor="#020617" />
                  </linearGradient>
                  <linearGradient id="tcBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#0b1220" />
                    <stop offset="0.5" stopColor="#475569" />
                    <stop offset="1" stopColor="#0b1220" />
                  </linearGradient>
                  <radialGradient id="tcJewel" cx="0.35" cy="0.35" r="0.75">
                    <stop offset="0" stopColor="#fef9c3" />
                    <stop offset="0.5" stopColor="#facc15" />
                    <stop offset="1" stopColor="#a16207" />
                  </radialGradient>
                  <filter id="tcShadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodColor="#000" floodOpacity="0.5" />
                  </filter>
                </defs>
                <g filter="url(#tcShadow)">
                  <polygon points="5,23 19,23 12,15" fill="url(#tcVert)" />
                  <rect x="10" y="1" width="4" height="21" rx="1.5" fill="url(#tcVert)" />
                  <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill="url(#tcBar)" />
                  <circle cx="12" cy="8.5" r="2.6" fill="url(#tcJewel)" stroke="#0f172a" strokeWidth="0.4" />
                </g>
              </svg>
            </h1>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
              <Button
                onClick={donate}
                disabled={upgrading}
                className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-medium px-2 sm:px-3 h-7 sm:h-8 text-xs rounded-full shadow-sm whitespace-nowrap"
              >
                <span>💛</span>
                <span className="hidden sm:inline">{upgrading ? 'Redirecting…' : 'Support — $5'}</span>
              </Button>
              <Link
                to="/feedback"
                className="inline-flex items-center justify-center gap-1 bg-stone-800 hover:bg-stone-900 text-white font-medium px-2 sm:px-3 h-7 sm:h-8 text-xs rounded-full shadow-sm whitespace-nowrap"
              >
                <span>💬</span>
                <span className="hidden sm:inline">Comment</span>
              </Link>
              <Link
                to="/learn"
                className="inline-flex items-center justify-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium px-2 sm:px-3 h-7 sm:h-8 text-xs rounded-full shadow-sm whitespace-nowrap"
              >
                <span>📖</span>
                <span className="hidden sm:inline">Learn</span>
              </Link>
            </div>
          </div>
          <p className="mt-3 text-sm sm:text-base text-stone-500 max-w-xl mx-auto text-center">
            On a ten×9 board with a piece that seeks Truth from the king{' '}
            <span className="inline-flex align-middle mx-0.5" title="Truth piece">
              <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block' }}>
                <polygon points="5,23 19,23 12,15" fill="#1f2937" />
                <rect x="10" y="0" width="4" height="23" rx="1.5" fill="#1f2937" />
                <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill="#1f2937" />
                <circle cx="12" cy="8.5" r="2.6" fill="#facc15" />
              </svg>
            </span>
            , flanking the King and Queen with a pawn in front. Truth moves like a Queen, captures opposing
            truth pieces and can put the king in Check. Conversely, the King can take the Truth.
          </p>
        </header>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center">
            {state && mode !== 'online' && (
              <div className="w-full max-w-[540px] mb-2">
                <ClockBar
                  whiteClock={whiteClock}
                  blackClock={blackClock}
                  active={gameOver ? null : turn}
                  flipped={effectiveFlipped}
                />
              </div>
            )}
            <div className="w-full max-w-[920px] mx-auto flex flex-col sm:flex-row justify-center gap-2">
              <div className="flex flex-col self-stretch sm:mt-3 gap-2">
                <nav
                  className="flex flex-col gap-2.5 p-2.5 bg-stone-100 rounded-2xl shadow-inner"
                  aria-label="Game mode"
                >
                  {visibleModes.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => guardedChangeMode(m.key)}
                      className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold rounded-xl whitespace-nowrap transition ${
                        mode === m.key
                          ? `${m.active} ring-1 shadow-sm`
                          : 'bg-white/60 text-stone-500 hover:text-stone-700 hover:bg-white'
                      }`}
                    >
                      <m.Icon className={`w-5 h-5 shrink-0 ${mode === m.key ? m.icon : 'text-stone-400'}`} />
                      {m.label}
                      {m.turbo && (
                        <span className="text-amber-500" style={{ fontSize: '1rem', lineHeight: 0 }}> ⚡</span>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="flex flex-col gap-1.5 mt-auto mb-8">
                  <div className="flex flex-col gap-1">
                    <p className="text-[0.6rem] uppercase tracking-widest text-stone-400 px-1">Time Control</p>
                    <select
                      value={timeControl}
                      onChange={(e) => setTimeControl(e.target.value)}
                      className="h-8 px-2 text-xs rounded-lg border border-stone-300 bg-white/90 backdrop-blur text-stone-700"
                    >
                      {Object.keys(TIME_CONTROLS).map((k) => (
                        <option key={k} value={k}>
                          {TIME_CONTROLS[k].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {mode === 'computer' && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[0.6rem] uppercase tracking-widest text-stone-400 px-1">Your color</p>
                      <div className="flex gap-1">
                        {[
                          { c: 'w', label: 'White' },
                          { c: 'b', label: 'Black' },
                        ].map((o) => (
                          <button
                            key={o.c}
                            type="button"
                            disabled={started}
                            onClick={() => setPlayerColor(o.c)}
                            className={`flex-1 h-8 px-2 text-xs rounded-lg border transition ${
                              playerColor === o.c
                                ? 'bg-stone-800 text-white border-stone-800'
                                : 'bg-white/90 text-stone-600 border-stone-300 hover:bg-stone-100'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(((mode === 'local' || mode === 'computer') && !gameOver) || (mode === 'online' && onlineGame && !spectator && myColor)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={offerDraw}
                      className="h-8 px-2 text-xs bg-white/90 backdrop-blur border-stone-300 justify-center"
                    >
                      Draw
                    </Button>
                  )}
                  {(((mode === 'local' || mode === 'computer') && !gameOver) || (mode === 'online' && onlineGame && !spectator && myColor)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resign}
                      className="h-8 px-2 text-xs bg-white/90 backdrop-blur border-stone-300 justify-center"
                    >
                      Resign
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={mode === 'online' ? resetOnline : resetLocal}
                    className="h-8 px-3 text-xs bg-white/90 backdrop-blur border-stone-300 justify-start gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset game
                  </Button>
                  <Button
                    size="sm"
                    variant={soundOn ? 'default' : 'outline'}
                    onClick={() => setSoundOn((s) => !s)}
                    className="h-8 px-3 text-xs bg-white/90 backdrop-blur text-stone-900 justify-start gap-2"
                  >
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    Sound
                  </Button>
                </div>
              </div>
              <div className="order-first sm:order-none flex flex-col items-center min-w-0 flex-1 w-full">
                {state ? (
                  <div className="my-3 w-full flex justify-center">{boardEl}</div>
                ) : (
                  <div className="w-full aspect-[10/9] rounded-2xl bg-white/60 ring-1 ring-stone-200 flex items-center justify-center text-stone-400 text-sm text-center px-6">
                    Create or join an online game to start playing
                  </div>
                )}
                {state && gameOver && positionList.length > 1 && (
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
              </div>
              {state && (
                <div className="flex flex-col justify-between self-stretch py-3 gap-4">
                  <CapturedSide pieces={viewCaptured.b} label="Black captured" />
                  {!spectator && (
                    <p
                      key={statusText + turn}
                      className="text-sm font-bold text-center leading-tight whitespace-nowrap animate-status-flash"
                    >
                      {statusText}
                    </p>
                  )}
                  <CapturedSide pieces={viewCaptured.w} label="White captured" />
                </div>
              )}
            </div>
            {state ? (
              <>
                <CheckmateEstimate />
                <MoveHistory sans={moveSanDisplay} />
                {hasAccess ? (
                  <ShareMoves sans={moveSanDisplay} resultStr={resultStr} onEmail={emailMoves} sending={sendingEmail} />
                ) : canUpgrade ? (
                  <ShareMoves
                    sans={moveSanDisplay}
                    resultStr={resultStr}
                    locked
                    onLocked={() => setShowPro(true)}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="w-full max-w-md">
              <LobbyPanel
                online={online}
                openGames={openGames}
                myIdentityId={identity.id}
                onJoinGame={joinSpecific}
              />
            </div>
            {!(mode === 'online' && onlineGame && onlineGame.status === 'active') && (
              <div className="w-full max-w-md">
                <SpectatePanel
                  activeGames={activeGames}
                  myId={identity.id}
                  onWatch={watchGame}
                  onRefresh={refreshOpenGames}
                />
              </div>
            )}
          </div>

          <aside className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {me && !identity.player_name && (
              <PlayerNameCard currentName={identity.player_name} onSave={savePlayerName} />
            )}
            {mode === 'online' && (
              <OnlinePanel
                onlineGame={onlineGame}
                myColor={myColor}
                myId={identity.id}
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
                onLeave={leaveOnline}
                onResign={resignOnline}
                onOfferDraw={offerDrawOnline}
                onAcceptDraw={acceptDrawOnline}
                onDeclineDraw={declineDrawOnline}
              />
            )}

            {mode !== 'online' && (
              <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-5 sm:col-span-2 lg:col-span-3">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">How to play</p>
                <ul className="space-y-2 text-sm text-stone-600 leading-relaxed">
                  <li>• Tap a piece to see its legal moves, then tap a highlighted square to move.</li>
                  <li>• Standard chess rules apply on a 10-wide, 9-rank board, including castling and en passant.</li>
                  <li>
                    • <span className="font-medium text-stone-800">Truth</span> (the † cross piece) moves like a
                    Queen. It captures only the opposing Truth, and can be captured only by the opposing King
                    or an opposing Truth — otherwise it acts as a passive blocker. It controls the squares it
                    slides to, so it can deliver check and checkmate. The Truth is free to move from the start, just like any other piece.
                  </li>
                  <li>• Pawns reaching the last rank promote (choose Q, R, B, N, or T for a Truth).</li>
                  <li>• Draws are detected automatically at threefold repetition and the 50-move rule; use <span className="font-medium text-stone-800">Draw</span> to agree a draw, <span className="font-medium text-stone-800">Hint</span> for a suggested move, and <span className="font-medium text-stone-800">Copy moves</span> to export the game, or <span className="font-medium text-stone-800">Email moves</span> to send it to yourself.</li>
                </ul>
                <Link
                  to="/learn"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
                >
                  Read the full guide →
                </Link>
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
              <li>• 2-Player local mode</li>
              <li>• Online multiplayer</li>
              <li>• Copy & email game moves</li>
              <li>• AI levels 4–8 for stronger play</li>
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
            <div className={`grid gap-2 ${maidenMode ? 'grid-cols-6' : 'grid-cols-5'}`}>
              {['Q', 'R', 'B', 'N', 'T', ...(maidenMode ? ['M'] : [])].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => choosePromo(t)}
                  className="aspect-square rounded-xl bg-stone-50 ring-1 ring-stone-200 hover:bg-amber-100 hover:ring-amber-400 transition flex items-center justify-center"
                >
                  {t === 'T' ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-8 h-8"
                      style={promo.color === 'w' ? { filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))' } : undefined}
                    >
                      <polygon points="5,23 19,23 12,15" fill={promo.color === 'w' ? '#f8fafc' : '#1f2937'} stroke={promo.color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="0.6" strokeLinejoin="round" />
                      <rect x="10" y="0" width="4" height="23" rx="1.5" fill={promo.color === 'w' ? '#f8fafc' : '#1f2937'} stroke={promo.color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="0.6" />
                      <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill={promo.color === 'w' ? '#f8fafc' : '#1f2937'} stroke={promo.color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="0.6" />
                      <circle cx="12" cy="8.5" r="2.6" fill="#facc15" stroke={promo.color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="0.3" />
                    </svg>
                  ) : (
                    <span
                      className="leading-none"
                      style={{
                        fontSize: t === 'M' ? '1.5rem' : '2rem',
                        fontWeight: t === 'M' ? 700 : 400,
                        fontFamily: t === 'M' ? 'ui-monospace, monospace' : undefined,
                        color: promo.color === 'w' ? '#f8fafc' : '#1f2937',
                        textShadow:
                          promo.color === 'w'
                            ? '0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.85)'
                            : '0 1px 1px rgba(255,255,255,0.25)',
                      }}
                    >
                      {t === 'M' ? 'M' : GLYPHS[t]}
                    </span>
                  )}
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
              <Button onClick={advance}>Level {Math.min(10, difficulty + 1)}</Button>
            </div>
          </div>
        </div>
      )}

      <Link
        to="/?maiden=1"
        aria-label="Play Truth Chess Maiden Mode"
        title="Truth Chess Maiden Mode"
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 ring-2 ring-amber-600/40 shadow-lg shadow-amber-500/40 hover:from-amber-400 hover:to-amber-600 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
          <path d="M12 5 C9 5 8 7 8 9 L6 23 L18 23 L16 9 C16 7 15 5 12 5 Z" fill="#fffbeb" stroke="#92400e" strokeWidth="0.6" strokeLinejoin="round" />
          <circle cx="12" cy="4.4" r="2.5" fill="#fffbeb" stroke="#92400e" strokeWidth="0.6" />
          <path d="M9.6 5.4 C7.2 7.5 6.6 12 7.2 15 L9 9 Z" fill="#fffbeb" opacity="0.85" />
          <path d="M14.4 5.4 C16.8 7.5 17.4 12 16.8 15 L15 9 Z" fill="#fffbeb" opacity="0.85" />
          <circle cx="12" cy="2.4" r="0.9" fill="#fde68a" stroke="#92400e" strokeWidth="0.25" />
        </svg>
      </Link>
    </div>
  );
}