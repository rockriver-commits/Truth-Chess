# Truth Chess ♛†

A free-to-play chess variant on a **10×9 board** with a unique piece: the **Truth** (†) — it moves like a Queen, but can only be captured by the opposing King (or another Truth). Flank the King and Queen with a pawn in front, and go seek Truth from the king.

**▶ Play it live: https://play-truth-chess.base44.app**

![Truth Chess board](docs/screenshot.png)

## What makes it different

- **The Truth piece (†)** — slides like a Queen, delivers check and checkmate, captures only the opposing Truth, and is a passive blocker to everything except the enemy King. Trading it wrong is the variant's signature trap.
- **10×9 board** — all standard chess rules (castling, en passant, promotion with a *Truth* promotion option) on a wider battlefield with an empty buffer rank.
- **Modes** — play vs Computer (10 levels), online with a live lobby, pass-and-play, or watch AI vs AI exhibitions.
- **The Zveritas engine** — a custom negamax search with alpha-beta, quiescence, and a transposition table, plus real learning: a server-backed **mate book** of solved checkmates, **position memory** (position → move → win/draw/loss), self-tuned evaluation weights, and adaptive aggression. Self-play training and strength-validation tournaments measure exactly what the learned systems add.
- **Fully free** — every mode and level is open to everyone.

## Rules in brief

1. Standard chess rules apply, on a ten-file, nine-rank board.
2. The Truth moves like a Queen. It captures only the opposing Truth; everything else it blocks.
3. The Truth can put the King in check — and the King can capture the Truth.
4. Pawns promote on the last rank (Q, R, B, N, or T).
5. Draws by threefold repetition and the 50-move rule are detected automatically.

## Tech

React + Tailwind (Vite) frontend, custom chess engine written from scratch in JavaScript (no external chess library), Base44 backend (auth, entities, real-time subscriptions, server functions).

## Run locally

```bash
npm install
npm install -g base44@latest
base44 login    # one-time
base44 link     # one-time per clone
base44 dev      # local backend + frontend together
```

See the [Base44 local development docs](https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview) for details. Publish changes from the Base44 dashboard after pushing.