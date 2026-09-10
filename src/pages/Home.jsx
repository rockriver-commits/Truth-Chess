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
} from '@/lib/chessVariant';

import { bestMove, DIFFICULTIES, materialBalance } from '@/lib/chessAI';
import { createEngineClient } from '@/lib/engineClient';
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
import { saveGame, loadSavedGame } from '@/lib/gamePersistence';
import { parseGameNotation } from '@/lib/sanParser';
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
import ImportGameDialog from '@/components/ImportGameDialog';
import TakeBackRefusal from '@/components/TakeBackRefusal';
import TruthPieceIcon, { TruthMarkInline } from '@/components/TruthPieceIcon';
import PromotionDialog from '@/components/PromotionDialog';
import HowToPlay from '@/components/HowToPlay';
import ResignFlowBanner from '@/components/ResignFlowBanner';
import LobbyPanel from '@/components/LobbyPanel';
import PlayerNameCard from '@/components/PlayerNameCard';
import { usePresence } from '@/hooks/usePresence';
import { Users, Computer, Globe, Bot, RotateCcw, Download, Volume2, VolumeX, Undo2 } from 'lucide-react';
import CapturedSide from '@/components/CapturedSide';
import EngineTraining from '@/components/EngineTraining';
import TournamentPanel from '@/components/TournamentPanel';

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
  // Refresh persistence: replay the saved local game (if any) once on mount so
  // a page refresh or an accidental back-button restores the game exactly
  // where it left off instead of restarting it. Online games are skipped —
  // they already live on the server.
  const savedGame = useMemo(() => loadSavedGame(), []);
  const restored = useMemo(() => {
    if (!savedGame) return null;
    try {
      const positions = replayStates(savedGame.moves);
      if (!positions || positions.length < 2) return null;
      const last = positions[positions.length - 1];
      const st = gameStatus(last.state);
      const wasOver =
        st === 'checkmate' || st === 'stalemate' || st === 'fifty_move' ||
        hasThreefold(savedGame.moves) ||
        !!savedGame.resigned || !!savedGame.drawAgreed ||
        !!savedGame.timedOut || !!savedGame.cvcResignResult;
      return {
        positions,
        state: last.state,
        captured: last.captured || { w: [], b: [] },
        lastMove: last.lastMove || null,
        wasOver,
      };
    } catch {
      return null;
    }
  }, [savedGame]);

  const [mode, setMode] = useState(restored ? savedGame.mode : 'computer'); // 'local' | 'computer' | 'online'

  // local / computer
  const [localState, setLocalState] = useState(restored ? restored.state : initialState);
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [localCaptured, setLocalCaptured] = useState(restored ? restored.captured : { w: [], b: [] });
  const [localLastMove, setLocalLastMove] = useState(restored ? restored.lastMove : null);
  const [promo, setPromo] = useState(null);
  const [difficulty, setDifficulty] = useState(restored ? savedGame.difficulty ?? 1 : 1);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState(restored ? restored.positions.slice(0, -1) : []);
  const [pendingAdvance, setPendingAdvance] = useState(false);
  // Opening book shared by AI-vs-AI and vs-Computer: a randomly chosen
  // traditional opening for the current game. The index into the book is just
  // localMoves.length, so it stays aligned with actual play.
  // A restored game skips the scripted opening book (its ply history no longer
  // matches a fresh opening): an empty book is truthy so the AI effect never
  // rolls a new one, and bookMove() finds nothing at every ply.
  const openingRef = useRef(restored ? { book: { moves: [] }, wTarget: null, bTarget: null } : { book: null, wTarget: null, bTarget: null });
  // A restored game that was already over had its result recorded before the
  // refresh — start these refs flagged so the outcome is never counted twice.
  const recordedRef = useRef(!!restored?.wasOver);
  const dailyStatRef = useRef(!!restored?.wasOver);
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
  const [resigned, setResigned] = useState(!!restored && !!savedGame.resigned);
  const [soundOn, setSoundOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [startMs, setStartMs] = useState(Date.now());
  const prevMovesLen = useRef(0);
  const playSound = useChessSounds(soundOn);
  const { toast } = useToast();

  // batch-2 additions
  const [localMoves, setLocalMoves] = useState(restored ? savedGame.moves : []);
  const [drawAgreed, setDrawAgreed] = useState(!!restored && !!savedGame.drawAgreed);
  const [reviewIdx, setReviewIdx] = useState(null);
  const [timeControl, setTimeControl] = useState(
    restored && savedGame.timeControl && TIME_CONTROLS[savedGame.timeControl]
      ? savedGame.timeControl
      : '30+0'
  );
  const [whiteClock, setWhiteClock] = useState(
    restored && Number.isFinite(savedGame.whiteClock) ? savedGame.whiteClock : TIME_CONTROLS['30+0'].initial
  );
  const [blackClock, setBlackClock] = useState(
    restored && Number.isFinite(savedGame.blackClock) ? savedGame.blackClock : TIME_CONTROLS['30+0'].initial
  );
  const [timedOut, setTimedOut] = useState(restored ? savedGame.timedOut ?? null : null);
  const [animateMove, setAnimateMove] = useState(null);
  const [showPro, setShowPro] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [started, setStarted] = useState(!!restored);
  const [sendingEmail, setSendingEmail] = useState(false);
  // AI vs AI agreed resignation: a lone-king side offers to resign and the
  // opponent accepts, shown to the spectator so they don't sit through a dead
  // 50-move grind. `autoResign` drives the visible offer→accept flow;
  // `cvcResignResult` ends the game.
  const [autoResign, setAutoResign] = useState(null);
  const [cvcResignResult, setCvcResignResult] = useState(restored ? savedGame.cvcResignResult ?? null : null);
  // Resetting an in-progress game shows a confirmation popup because it
  // counts as a resignation (the game is recorded as a loss before resetting).
  const [resetConfirm, setResetConfirm] = useState(false);
  // Paste-a-game import dialog: recreate a game from notation on the board.
  const [showImport, setShowImport] = useState(false);
  // Take-back: Zveritas' refusal message in vs Computer mode — dismissed by a
  // board click or 10 seconds after it appears, whichever comes first.
  const [takeBackRefusal, setTakeBackRefusal] = useState(false);
  const takeBackTimerRef = useRef(null);
  // Deep training mode: counts consecutive self-play games played this session.
  const [trainingGames, setTrainingGames] = useState(0);
  // Engine Training card: chosen game count + search depth, plus an active flag
  // that drives AI-vs-AI self-play at ~120ms cadence until the target is met.
  const [trainingActive, setTrainingActive] = useState(false);
  const [trainingTarget, setTrainingTarget] = useState(25);
  const [trainingDepth, setTrainingDepth] = useState(6);
  const prevSoundRef = useRef(true);
  // vs Computer: the human's color for the current game. Default White; a
  // player who wins as Black earns White for the next game (traditional chess).
  const [playerColor, setPlayerColor] = useState(restored && savedGame.playerColor === 'b' ? 'b' : 'w');
  const wonAsBlackRef = useRef(false);
  const computerColor = playerColor === 'w' ? 'b' : 'w';
  // Pondering engine worker (vs Computer): while the human is deciding, the
  // engine keeps searching in a background worker — wave after wave, each one
  // deeper — so the waiting time becomes thinking time and the reply after the
  // human's move starts from a warmed-up, deeper search.
  const engineClientRef = useRef(null);
  const engineSearchSeq = useRef(0);
  const ponderTimerRef = useRef(null);

  // online
  const [me, setMe] = useState(null);
  // True once the sign-in check has finished either way (logged in or guest).
  // Online games must not be created or joined before this resolves: while the
  // check is pending the player is treated as a guest, so the game record would
  // store a temporary guest id — and once the real account loads, that player
  // is no longer recognized as White/Black (can't move, no take-back button).
  const [authReady, setAuthReady] = useState(false);
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
      .catch(() => { setMe(null); })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    document.title = 'Truth Chess';
  }, []);

  // Create the pondering engine worker once. If workers are unavailable, the
  // vs-Computer AI falls back to the original in-page search automatically.
  useEffect(() => {
    engineClientRef.current = createEngineClient();
    return () => {
      if (engineClientRef.current) engineClientRef.current.dispose();
      engineClientRef.current = null;
    };
  }, []);

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
  // Mini-board links open a game with ?watch=CODE — spectate it in this tab
  // once the live-games list loads it. Keyed on the route search so a
  // same-page navigation to a watch link works too.
  const watchParamRef = useRef(null);
  const location = useLocation();
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search).get('watch');
      if (p) watchParamRef.current = p.toUpperCase();
    } catch { /* ignore */ }
  }, [location.search]);
  const prevOnlineStatusRef = useRef(null);
  const identityRef = useRef(null);

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
    // Any board click dismisses the take-back refusal message.
    if (takeBackRefusal) {
      setTakeBackRefusal(false);
      if (takeBackTimerRef.current) {
        clearTimeout(takeBackTimerRef.current);
        takeBackTimerRef.current = null;
      }
    }
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

  // Take back the last move(s): vs Computer, Zveritas always accepts unless
  // its analysis says it stands clearly worse — then it refuses with a smiley
  // and the request is dropped. Online, it sends the opponent a take-back
  // offer they can accept (the last move is undone) or decline.
  function requestTakeBack() {
    if (mode === 'online') {
      proposeTakeBackOnline();
      return;
    }
    if (mode !== 'computer' || gameOver || thinking || promo) return;
    if (materialBalance(localState, computerColor) < -150) {
      if (takeBackTimerRef.current) clearTimeout(takeBackTimerRef.current);
      setTakeBackRefusal(true);
      takeBackTimerRef.current = setTimeout(() => {
        takeBackTimerRef.current = null;
        setTakeBackRefusal(false);
      }, 10000);
      return;
    }
    undo();
  }

  // Resetting an in-progress game counts as a resignation: confirm with a
  // popup so the player knows the current game is recorded as a loss before
  // the board resets to a fresh one. Idle / finished games reset directly.
  function handleReset() {
    const humanInProgress =
      started &&
      !gameOver &&
      (mode === 'local' || mode === 'computer' || (mode === 'online' && onlineGame?.status === 'active' && !spectator && myColor));
    if (!humanInProgress) {
      if (mode === 'online') resetOnline();
      else resetLocal();
      return;
    }
    setResetConfirm(true);
  }

  function confirmReset() {
    setResetConfirm(false);
    if (mode === 'online') {
      resetOnline();
      return;
    }
    setResigned(true);
    setTimeout(() => resetLocal(), 900);
  }

  // Import a game from PGN/SAN notation: recreate it on the board in vs
  // Computer mode and hand the next move to Zveritas — the human plays the
  // color that is NOT on move. Returns an error string, or null on success.
  function importGame(text) {
    let moves;
    try {
      moves = parseGameNotation(text);
    } catch (e) {
      return e.message;
    }
    if (!moves.length) return 'No moves found in that notation.';
    const positions = replayStates(moves);
    const last = positions[positions.length - 1];
    leaveOnline();
    if (trainingActive) {
      setTrainingActive(false);
      setSoundOn(prevSoundRef.current);
    }
    cleanupComputerBroadcast();
    setMode('computer');
    setLocalMoves(moves);
    setLocalState(last.state);
    setLocalCaptured(last.captured || { w: [], b: [] });
    setLocalLastMove(last.lastMove || null);
    setHistory(positions.slice(0, -1));
    setSelected(null);
    setLegalMoves([]);
    setPromo(null);
    setHint(null);
    setHintLoading(false);
    setResigned(false);
    setDrawAgreed(false);
    setTimedOut(null);
    setCvcResignResult(null);
    setReviewIdx(null);
    setPendingAdvance(false);
    setStarted(true);
    setStartMs(Date.now());
    setElapsed(0);
    // Zveritas plays the side on move; the human takes the other color.
    setPlayerColor(last.state.turn === 'w' ? 'b' : 'w');
    wonAsBlackRef.current = false;
    openingRef.current = { book: { moves: [] }, wTarget: null, bTarget: null };
    recordedRef.current = false;
    const tc = TIME_CONTROLS[timeControl];
    setWhiteClock(tc.initial);
    setBlackClock(tc.initial);
    toast({
      title: 'Game imported',
      description: `${Math.ceil(moves.length / 2)} moves loaded — Zveritas plays ${last.state.turn === 'w' ? 'White' : 'Black'}.`,
    });
    return null;
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
    if (trainingActive) {
      setTrainingActive(false);
      setSoundOn(prevSoundRef.current);
    }
    setMode(m);
    setTrainingGames(0);
    resetLocal();
  }

  function startTraining() {
    prevSoundRef.current = soundOn;
    trainingGamesRef.current = 0;
    setTrainingGames(0);
    setTrainingActive(true);
    setSoundOn(false);
    setMode('cvc_turbo');
    resetLocal();
    setStarted(true);
  }

  function stopTraining() {
    setTrainingActive(false);
    setSoundOn(prevSoundRef.current);
    setMode('computer');
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
    if (!authReady) {
      setOnlineError('Signing you in — try again in a moment.');
      return;
    }
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
      toast({
        title: 'Online game started',
        description: `Waiting for an opponent to join — code ${code}`,
      });
    } catch (e) {
      setOnlineError('Could not create game.');
    }
  }

  async function joinOnline(code) {
    setOnlineError('');
    if (!authReady) {
      setOnlineError('Signing you in — try again in a moment.');
      return;
    }
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
      const patch = { moves: newMoves, last_move_at: new Date().toISOString(), draw_offer_by: null, take_back_offer_by: null };
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

  async function proposeTakeBackOnline() {
    if (!onlineGame || onlineGame.status !== 'active' || !myColor) return;
    if (!(onlineGame.moves || []).length) return;
    try {
      const updated = await base44.entities.Game.update(onlineGame.id, { take_back_offer_by: myColor });
      setOnlineGame(updated);
      toast({ title: 'Take back proposed', description: 'Waiting for your opponent to accept…' });
    } catch {
      setOnlineError('Could not propose take back.');
    }
  }

  async function acceptTakeBackOnline() {
    if (!onlineGame || onlineGame.status !== 'active') return;
    try {
      const moves = (onlineGame.moves || []).slice(0, -1);
      const updated = await base44.entities.Game.update(onlineGame.id, {
        moves,
        take_back_offer_by: null,
        last_move_at: new Date().toISOString(),
      });
      prevMovesLen.current = moves.length;
      setOnlineGame(updated);
      playSound('move');
    } catch {
      setOnlineError('Could not accept take back.');
    }
  }

  async function declineTakeBackOnline() {
    if (!onlineGame) return;
    try {
      const updated = await base44.entities.Game.update(onlineGame.id, { take_back_offer_by: null });
      setOnlineGame(updated);
    } catch {
      setOnlineError('Could not decline take back.');
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
        await base44.functions.invoke('email-game', { to: ownEmail, sans: moveSanDisplay, resultStr, imageUrl, appUrl: window.location.origin });
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
    const gameTitle = 'Truth Chess';
    const gameLink = `${window.location.origin}/`;
    const body = `${pgn}\n\nPlay again: ${gameLink}${imageUrl ? `\n\nView the final board: ${imageUrl}` : ''}`;
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`My ${gameTitle} Game`)}&body=${encodeURIComponent(body)}`;
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
      const myId = identityRef.current?.id;
      const stale = (waiting || []).filter((g) => {
        if (onlineGame && g.id === onlineGame.id) return false;
        if (myId && (g.white_player_id === myId || g.black_player_id === myId)) return false;
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
        if (myId && (g.white_player_id === myId || g.black_player_id === myId)) return false;
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
    if (!authReady) {
      setOnlineError('Signing you in — try again in a moment.');
      return;
    }
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
    if (!authReady) {
      setOnlineError('Signing you in — try again in a moment.');
      return;
    }
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
    if (!authReady) {
      setOnlineError('Signing you in — try again in a moment.');
      return;
    }
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
        } else if (newLen < prevMovesLen.current) {
          prevMovesLen.current = newLen; // a take back shrank the game
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

  // Delete the vs-Computer broadcast record when the page unmounts (route
  // navigation). An active online game is deliberately NOT forfeited here:
  // clicking away (Comment, Learn, browser back inside the app) keeps it
  // alive on the server, and the rejoin effect below returns the player to it
  // when they come back. Only closing the tab outright (beforeunload above)
  // or explicitly leaving/resigning ends the game.
  useEffect(() => {
    return () => {
      const g = computerGameRef.current;
      if (g) {
        base44.entities.Game.delete(g.id).catch(() => {});
      }
    };
  }, []);

  useEffect(() => { identityRef.current = identity; }, [identity]);

  // Returning to an interrupted online game: coming back to the game page
  // automatically rejoins any active online game this player is part of, so
  // play continues where it left off instead of the game silently dying.
  useEffect(() => {
    if (watchParamRef.current) return; // a mini-board link is spectating another game
    if (onlineGame || spectator || !identity?.id || !activeGames.length) return;
    const mine = activeGames.find(
      (g) =>
        g.status === 'active' &&
        (g.white_player_id === identity.id || g.black_player_id === identity.id) &&
        g.white_player_id !== '__computer__' && g.black_player_id !== '__computer__' &&
        g.white_player_id !== '__ghost__' && g.black_player_id !== '__ghost__'
    );
    if (!mine) return;
    setMode('online');
    reenterOwn(mine);
    toast({ title: 'Back in your game', description: 'Your online game is still live — play on.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGames, identity?.id, onlineGame, spectator]);

  // ?watch=CODE (mini-board links): spectate that game in this tab once the
  // live-games list has loaded it.
  useEffect(() => {
    const code = watchParamRef.current;
    if (!code || spectator || !activeGames.length) return;
    const g = activeGames.find((x) => x.code === code);
    if (!g) return;
    watchParamRef.current = null;
    watchGame(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGames, spectator, location.search]);

  // Waiting cue: when the opponent joins the game we created, say so — the
  // on-board "waiting for an opponent" banner disappears with the join.
  useEffect(() => {
    if (mode !== 'online' || !onlineGame) {
      prevOnlineStatusRef.current = null;
      return;
    }
    const prev = prevOnlineStatusRef.current;
    prevOnlineStatusRef.current = onlineGame.status;
    if (prev === 'waiting' && onlineGame.status === 'active') {
      toast({ title: 'Opponent joined!', description: 'Your online game has started.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGame]);

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
  // plays the search engine — in the pondering worker when available (falling
  // back to the in-page search otherwise). Never allows threefold repetition.
  useEffect(() => {
    if (mode !== 'computer' || turn !== computerColor || gameOver || promo || !started) return;
    if (!openingRef.current.book) {
      openingRef.current = {
        book: randomOpening(),
        wTarget: computerColor === 'w' ? rollOpeningTarget('w', localState.board) : null,
        bTarget: computerColor === 'b' ? rollOpeningTarget('b', localState.board) : null,
      };
    }
    const token = ++engineSearchSeq.current;
    setThinking(true);
    const t = setTimeout(() => {
      const legal = allLegalMoves(localState, computerColor);
      const sideTarget = computerColor === 'w' ? openingRef.current.wTarget : openingRef.current.bTarget;
      const scripted = sideTarget
        ? null
        : bookMove(openingRef.current.book, localMoves.length, legal, computerColor);
      const finish = (m) => {
        let move = m;
        // Always avoid threefold repetition (unless no other legal move avoids
        // it), even for opening-book moves.
        if (move) move = pickNonRepeating(localState, move, localMoves);
        if (move) commitMove(move, 'Q');
        setThinking(false);
      };
      if (scripted) {
        finish(scripted);
        return;
      }
      const ctx = {
        ply: localMoves.length,
        wTarget: openingRef.current.wTarget ? openingRef.current.wTarget.type : null,
        bTarget: openingRef.current.bTarget ? openingRef.current.bTarget.type : null,
        positionKeys: positionList.map((p) => positionKey(p.state)),
      };
      const client = engineClientRef.current;
      if (client) {
        client
          .search(localState, computerColor, difficulty, ctx, (DIFFICULTIES[difficulty] || DIFFICULTIES[4]).timeMs + 8000)
          .then((m) => {
            if (engineSearchSeq.current !== token) return; // stale reply — reset/new search superseded it
            finish(m);
          })
          .catch(() => {
            if (engineSearchSeq.current !== token) return;
            finish(bestMove(localState, computerColor, difficulty, false, ctx)); // worker fallback
          });
      } else {
        finish(bestMove(localState, computerColor, difficulty, false, ctx));
      }
    }, 350);
    return () => {
      clearTimeout(t);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver, promo, localState, difficulty, turn, localMoves, started, computerColor]);

  // Pondering (vs Computer only): while the human is deciding their move, the
  // engine keeps searching in the background worker — one short wave after
  // another, each deeper than the last — so by the time the player finally
  // moves, the engine has already spent the waiting time on deep analysis and
  // its reply search starts from the warmed-up search memory.
  useEffect(() => {
    if (mode !== 'computer' || !started || gameOver) return;
    if (turn !== playerColor) return; // ponder only during the human's turn
    const client = engineClientRef.current;
    if (!client) return;
    let cancelled = false;
    let wave = 0;
    const tick = () => {
      if (cancelled) return;
      client.ponder(localState, computerColor, difficulty, wave++);
      ponderTimerRef.current = setTimeout(tick, 1700);
    };
    ponderTimerRef.current = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (ponderTimerRef.current) {
        clearTimeout(ponderTimerRef.current);
        ponderTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, started, gameOver, turn, localState, difficulty, computerColor, playerColor]);

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
    const baseDelay = trainingActive ? 120 : mode === 'cvc_turbo' ? 500 : [910, 1500, 2000][Math.floor(Math.random() * 3)];
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
        const searchDepth = trainingActive ? trainingDepth : mode === 'cvc_turbo' ? 3 : 7;
        move = bestMove(localState, localState.turn, searchDepth, true, ctx);
      }
      // Always avoid threefold repetition (unless no other legal move avoids
      // it), even for opening-book moves.
      if (move) move = pickNonRepeating(localState, move, localMoves);
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

  // Engine Training auto-restart: when a self-play game ends, count it and
  // start a fresh one back-to-back until the chosen game-count target is met,
  // then stop. A ref guard ensures each game-over is counted exactly once.
  // The 1.2s between-games timer lives in a ref, NOT as effect cleanup: the
  // counter update used to re-run this effect (trainingGames was a dep), and
  // the cleanup cancelled the pending restart before it fired — which
  // stranded training after game 1. gameOver stays true until the timer
  // itself resets the board, so nothing clears the timer mid-wait.
  const trainingCountedRef = useRef(false);
  const trainingGamesRef = useRef(0);
  const trainingTimerRef = useRef(null);
  useEffect(() => {
    if (mode !== 'cvc_turbo' || !trainingActive) return;
    if (!gameOver) { trainingCountedRef.current = false; return; }
    if (trainingCountedRef.current) return;
    trainingCountedRef.current = true;
    if (trainingTimerRef.current) clearTimeout(trainingTimerRef.current);
    trainingTimerRef.current = setTimeout(() => {
      trainingTimerRef.current = null;
      trainingGamesRef.current += 1;
      const newCount = trainingGamesRef.current;
      setTrainingGames(newCount);
      if (newCount >= trainingTarget) stopTraining();
      else {
        resetLocal();
        setStarted(true);
      }
    }, 1200);
    return () => {
      if (trainingTimerRef.current) {
        clearTimeout(trainingTimerRef.current);
        trainingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, trainingActive, gameOver, trainingTarget]);

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

  // --- refresh persistence -------------------------------------------------
  // Local games (2 Players, vs Computer, AI vs AI) are saved to the browser as
  // they're played and restored on load, so a page refresh or an accidental
  // back-button resumes the game instead of restarting it. Critical changes
  // (a move, settings) save immediately; clock-only changes are throttled to
  // roughly one save per second. Online games are skipped — they already live
  // on the server.
  const saveFlushRef = useRef(true);
  const lastSaveAtRef = useRef(0);
  useEffect(() => {
    saveFlushRef.current = true;
  }, [localMoves, started, mode, timeControl, playerColor, difficulty, resigned, drawAgreed, timedOut, cvcResignResult]);
  useEffect(() => {
    if (mode === 'online') return;
    const now = Date.now();
    if (!saveFlushRef.current && now - lastSaveAtRef.current < 900) return;
    saveFlushRef.current = false;
    lastSaveAtRef.current = now;
    saveGame({
      mode,
      moves: localMoves,
      playerColor,
      difficulty,
      timeControl,
      whiteClock,
      blackClock,
      started,
      resigned,
      drawAgreed,
      timedOut,
      cvcResignResult,
    });
  }, [mode, localMoves, playerColor, difficulty, timeControl, whiteClock, blackClock, started, resigned, drawAgreed, timedOut, cvcResignResult]);

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
      {takeBackRefusal && <TakeBackRefusal />}
      {mode === 'online' && onlineGame?.status === 'waiting' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-full bg-stone-900/85 text-white text-[0.7rem] font-medium px-3 py-1.5 shadow-lg backdrop-blur pointer-events-none text-center whitespace-nowrap">
          Online game started — waiting for an opponent
          <span className="hidden sm:inline"> (code {onlineGame.code})</span>
        </div>
      )}
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
          <div className="relative mt-2 flex flex-col items-center justify-center gap-2">
            <h1 className="flex flex-col items-center justify-center gap-1 text-4xl sm:text-5xl font-display font-semibold tracking-tight text-stone-800 text-center">
              <span className="inline-flex items-center justify-center gap-2">
                Truth Chess
                <TruthPieceIcon className="h-[0.85em] w-[0.85em] shrink-0" />
              </span>
            </h1>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
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
            <TruthMarkInline />
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
              <div className="flex flex-col self-start sm:mt-3 gap-2">
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
                <div className="flex flex-col gap-1.5 mb-8">
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
                  {mode === 'computer' && !gameOver && localMoves.length >= 2 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={requestTakeBack}
                      className="h-8 px-3 text-xs bg-white/90 backdrop-blur border-stone-300 justify-start gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Take back
                    </Button>
                  )}
                  {mode === 'online' && onlineGame?.status === 'active' && myColor && !spectator && (onlineGame.moves || []).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={requestTakeBack}
                      disabled={!!onlineGame.take_back_offer_by}
                      className="h-8 px-3 text-xs bg-white/90 backdrop-blur border-stone-300 justify-start gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Take back
                    </Button>
                  )}
                  {mode === 'online' && onlineGame?.status === 'active' && onlineGame.take_back_offer_by && myColor && !spectator && (
                    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-300 p-2.5">
                      {onlineGame.take_back_offer_by === myColor ? (
                        <p className="text-[0.7rem] font-medium text-amber-800">
                          Take back proposed — waiting for your opponent…
                        </p>
                      ) : (
                        <>
                          <p className="text-[0.7rem] font-semibold text-amber-800">
                            Opponent proposes a take back
                          </p>
                          <div className="flex gap-1.5 mt-2">
                            <Button size="sm" className="h-7 flex-1 text-xs" onClick={acceptTakeBackOnline}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={declineTakeBackOnline}>
                              Decline
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    className="h-8 px-3 text-xs bg-white/90 backdrop-blur border-stone-300 justify-start gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset game
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowImport(true)}
                    className="h-8 px-3 text-xs bg-white/90 backdrop-blur border-stone-300 justify-start gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Import game
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
                  <div className="my-3 w-full flex flex-col gap-2">
                    <div className="w-full flex flex-col sm:flex-row justify-center items-stretch gap-2">
                      {boardEl}
                      <div className="flex flex-col justify-between self-stretch gap-4 pb-5 w-full sm:w-32 sm:shrink-0">
                        <CapturedSide pieces={viewCaptured.b} label="Black captured" />
                        {!spectator && (
                          <p
                            key={statusText + turn}
                            className="text-sm font-bold text-center leading-tight animate-status-flash"
                          >
                            {statusText}
                          </p>
                        )}
                        <CapturedSide pieces={viewCaptured.w} label="White captured" />
                      </div>
                    </div>
                    {state && positionList.length > 1 && (
                      <div className="w-full flex justify-center gap-2">
                        <div className="w-full max-w-[600px] flex justify-center">
                          <ReplayBar
                            index={reviewIdx}
                            total={positionList.length}
                            disabled={!gameOver}
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
                        </div>
                        <div className="hidden sm:block w-32 shrink-0" aria-hidden="true" />
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="w-full aspect-[10/9] rounded-2xl bg-white/60 ring-1 ring-stone-200 flex items-center justify-center text-stone-400 text-sm text-center px-6">
                    Create or join an online game to start playing
                  </div>
                )}
              </div>
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
            {me?.role === 'admin' && (
              <EngineTraining
                active={trainingActive}
                target={trainingTarget}
                depth={trainingDepth}
                gamesCompleted={trainingGames}
                onStart={startTraining}
                onStop={stopTraining}
                onSelectTarget={setTrainingTarget}
                onSelectDepth={setTrainingDepth}
              />
            )}
            {me?.role === 'admin' && <TournamentPanel />}
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

            {mode !== 'online' && <HowToPlay />}
          </aside>
        </div>

        <div className="mt-8 space-y-6">
          {me && <StatsPanel userId={me.id} />}
          <Leaderboard />
        </div>

        <div className="flex justify-center mt-6">
          <Button
            onClick={donate}
            disabled={upgrading}
            variant="outline"
            className="h-9 px-4 text-sm bg-white/90 backdrop-blur text-stone-900 gap-2"
          >
            💛 Support — $5
          </Button>
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

      <ImportGameDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSubmit={importGame}
      />

      <PromotionDialog promo={promo} onChoose={choosePromo} />

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

      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <p className="text-lg font-semibold text-stone-800">Reset = resignation</p>
            <p className="text-sm text-stone-500 mt-2 mb-5">
              Resetting now will count this game as a loss (resignation), then start a fresh one. Continue?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setResetConfirm(false)} variant="outline">Cancel</Button>
              <Button onClick={confirmReset} className="bg-rose-600 hover:bg-rose-700 text-white">Reset & resign</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}