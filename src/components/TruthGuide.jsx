import React from 'react';
import OpeningsGallery from '@/components/OpeningsGallery';

// The Truth Chess guide — substantial publisher content shared by the game
// page and the dedicated /learn page. Keeping it in one component avoids
// duplication and lets the game page carry real content alongside the board
// (so AdSense-served ads appear on a content-rich screen).
function H2({ children }) {
  return <h2 className="mt-10 text-xl font-display font-semibold text-stone-800">{children}</h2>;
}

export default function TruthGuide() {
  return (
    <section className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-6 sm:p-8">
      <header className="mb-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-600/80">
          A Chess Variant
        </p>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight text-stone-800">
          Truth Chess — A Complete Guide
        </h2>
        <p className="mt-2 text-stone-500">
          Everything you need to know about the 10×9 board, the Truth piece, and how to win.
        </p>
      </header>

      <H2>What is Truth Chess?</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Truth Chess is a chess variant played on an expanded <strong>10-file by 9-rank</strong> board.
        It preserves the rules you already know from standard chess — castling, en passant, pawn
        promotion, check and checkmate — and introduces one original piece: the <strong>Truth</strong>.
        The result is a game that feels familiar but rewards a fresh style of play, because the Truth
        changes how you defend your king, how you blockade your opponent, and how you force mate.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The wider board means more space, more open lines for the bishops and rooks, and a longer
        casting distance for the king. Games tend to be sharper and more tactical than standard chess,
        with the Truth piece often at the center of the decisive combinations.
      </p>

      <H2>The board and starting position</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The board has ten files (labelled <em>a</em> through <em>j</em>) and nine ranks. White occupies
        the bottom two ranks; Black occupies the top two. Between the two armies sits a buffer of three
        empty ranks, so the forces start five ranks apart — farther than in standard chess. This extra
        distance gives both sides room to develop before contact, and it makes the opening phase more
        about maneuvering for good squares than about immediate tactical clashes.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Each side's back rank is <strong>R N B T Q K T B N R</strong>. The Truth pieces sit beside the
        queen and king, each with a pawn directly in front of it. The second rank is a full row of ten
        pawns.
      </p>

      <H2>How the pieces move</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Every standard piece moves exactly as it does in orthodox chess. Pawns step forward one square
        (or two from their starting rank), capture diagonally, and promote when they reach the last
        rank. Knights jump in their usual L-shape, bishops run along diagonals, rooks along files and
        ranks, and the queen combines rook and bishop movement. The king moves one square in any
        direction. Castling, en passant, and the 50-move and threefold-repetition draw rules all apply.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The only piece with new movement is the Truth, described in the next section.
      </p>

      <H2>The Truth piece</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The Truth moves like a queen — it slides any number of squares along files, ranks, and
        diagonals. What makes it unlike any other piece is what it can and cannot capture:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>The Truth can capture <strong>only the opposing Truth</strong>. Every other enemy piece blocks it.</li>
        <li>
          The Truth can be captured only by the <strong>opposing king</strong> or the <strong>opposing
          Truth</strong>. No other piece — not even a queen or rook — can take it.
        </li>
        <li>
          Although the Truth does not capture ordinary pieces, it still <strong>controls</strong> every
          square it slides through. That means it can deliver <strong>check</strong> and
          <strong> checkmate</strong> to the enemy king.
        </li>
      </ul>
      <p className="mt-3 text-stone-600 leading-relaxed">
        This single rule set creates a piece that is at once a powerful attacker and a permanent
        defensive blocker. Because almost nothing can remove it, a well-placed Truth can cramp an
        opponent for the entire game — and because it gives check, it can also be the piece that
        delivers mate.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>The Truth is free to move from the very first move.</strong> There is no lock and no
        unlocking condition — you can develop, reposition, or attack with your Truth at any time, just
        like any other piece. Its only limits are the ones above: it captures only the opposing Truth,
        and only the opposing king or opposing Truth can capture it. Because it is both mobile and
        nearly impossible to remove, the Truth is active from the opening onward, shaping the center
        and delivering checks whenever an open line appears.
      </p>

      <H2>Special moves: castling, en passant, promotion</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Castling</strong> works as in standard chess, adjusted for the wider board: the king
        slides two squares toward a rook and the rook jumps to the king's other side. Neither the king
        nor the rook may have moved, the squares between must be empty, and the king may not pass
        through or land on an attacked square.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>En passant</strong> lets a pawn capture an enemy pawn that has just advanced two
        squares, as though it had moved only one — exactly as in standard chess. <strong>Promotion</strong>
        occurs when a pawn reaches the last rank; you choose a queen, rook, bishop, knight, or a
        Truth.
      </p>

      <H2>Check, checkmate, and the Truth</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        A king is in check when an enemy piece attacks its square. Because the Truth controls the
        squares it slides to, a Truth on an open line can check the king from a distance — and since
        the Truth cannot be captured by ordinary pieces, the only ways out of a Truth-check are to
        move the king, to block the line with another piece, or to capture the Truth with your own king
        (only possible if the Truth is adjacent and undefended).
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Checkmate is reached when the side to move is in check and has no legal reply. Stalemate — when
        the side to move has no legal move but is not in check — is a draw, as in standard chess.
      </p>

      <H2>Strategy guide</H2>
      <h3 className="mt-5 text-base font-semibold text-stone-700">The opening</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        Use the three buffer ranks to develop your minor pieces before committing pawns. Because the
        board is wider, control of the center is shared among more files; aim your pawn advances at the
        squares your knights and bishops want. The Truth is free to move from the start, so you can
        also use it early to claim an open line or plant a blockade — just remember it is hard to
        remove once placed.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">Using the Truth as a blocker</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        The Truth's immunity makes it an ideal blockade piece. Planting a Truth in front of an enemy
        rook or on a central square denies that square permanently — your opponent can almost never
        trade it away. This is especially strong in the opening and middlegame, where denying
        development squares compounds quickly.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">Attacking with the Truth</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        On an open file or diagonal the Truth generates checks the enemy king cannot easily escape. A
        common mating pattern is to pin the king on the back rank with a rook or queen, then use the
        Truth to deliver the final check from a distance the king cannot reach. Beware, though: a
        Truth that checks the enemy king while adjacent to it and undefended can simply be captured by
        that king — so support your Truth or keep it at a safe range.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">The endgame</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        In the endgame the Truth's inability to be captured becomes decisive. With few pieces left,
        your king is the only one that can hunt the enemy Truth — and the enemy king is the only one
        that can hunt yours. March your king toward the opposing Truth to capture it, while keeping
        your own Truth out of the enemy king's reach. Passed pawns with a clear path to promotion are
        especially valuable here.
      </p>

      <H2>Truth Chess openings — a starter repertoire</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The Veritas engine plays from a repertoire of twenty-three traditional openings adapted
        to the 10×9 board. Below are six of the most instructive, each shown as the exact position
        the engine reaches after its scripted opening moves. Files run a–j left to right; the
        Queen stands on the e-file and the King on the f-file, with a Truth flanking each. Early
        self-play data is still thin, but the queen's-pawn opening has been the strongest so far —
        two wins and a draw from its first three recorded games.
      </p>
      <OpeningsGallery />

      <H2>Frequently asked questions</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Can a pawn capture the Truth?</strong> No. Pawns, like all pieces except the king and
        the opposing Truth, cannot capture a Truth; it simply blocks them.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Can the Truth be put in check?</strong> The Truth is not a king, so it is never "in
        check" — but it can be threatened with capture by the enemy king or the enemy Truth, and you
        may want to move it away when it is.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>What happens if only the two kings remain?</strong> The game is a draw, as in standard
        chess. With more material, push to convert your advantage into checkmate before the opponent can
        claim a draw.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Is en passant allowed?</strong> Yes — all standard chess special moves apply, including
        en passant, castling, and promotion.
      </p>

      <H2>Inside the engine — meet Veritas</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The AI you play against is <strong>Veritas</strong>, an engine written from scratch for the
        Truth Chess board and rules. Veritas is not a port of an 8×8 engine with the board stretched —
        its move generator, evaluation, and learning were all built for the 10×9 geometry and the Truth
        piece. It runs entirely in your browser, so it never calls a paid server and never sends your
        position anywhere. Every move you see is computed live on your device.
      </p>

      <h3 className="mt-5 text-base font-semibold text-stone-700">How Veritas thinks</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        At its core Veritas uses <strong>iterative-deepening negamax search with alpha-beta pruning</strong> —
        the same family of algorithm that powers nearly every strong chess engine, but adapted here for
        Truth Chess. It searches deeper and deeper one ply at a time, and because each completed depth
        produces a best move, it can always fall back to the last good answer if it runs out of time.
        On top of that backbone it layers the classic optimizations that make a search practical:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>
          <strong>A transposition table with Zobrist hashing.</strong> Every position is hashed, so if
          the search reaches the same arrangement by a different move order it reuses the earlier result
          instead of re-searching. This alone can double or triple effective depth.
        </li>
        <li>
          <strong>Quiescence search.</strong> At the bottom of the tree Veritas keeps searching only
          captures, promotions, and checks until the position is "quiet" — so it never stops mid-trade
          and misjudges a position that still has a hanging piece. This is the single biggest reason
          the engine doesn't blunder material.
        </li>
        <li>
          <strong>Move ordering.</strong> Captures are tried first using MVV-LVA (most valuable victim,
          least valuable attacker), then the transposition-table move, then <em>killer moves</em> (quiet
          moves that caused cutoffs in sibling nodes) and a <em>history table</em> of quiet moves that
          have done well. Good ordering is what lets alpha-beta prune aggressively.
        </li>
        <li>
          <strong>Null-move pruning.</strong> When not in check and with material to spare, Veritas can
          "pass" a turn at reduced depth; if the opponent still can't beat the current best, the whole
          line is pruned. It skips this in bare king-and-pawn endings to avoid zugzwang mistakes.
        </li>
        <li>
          <strong>Late-move reductions and check extensions.</strong> Quiet moves searched late get a
          shallower look (with a full re-search if they surprisingly look good), while checking moves
          get an extra ply so forcing mates are found inside the depth budget.
        </li>
      </ul>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Hard limits keep the browser responsive: a node cap and a wall-clock deadline stop any search
        before it can freeze the page, so even a deep quiescence can never stall the UI.
      </p>

      <h3 className="mt-5 text-base font-semibold text-stone-700">Evaluation built for Truth Chess</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        Veritas scores a position with far more than material. Its evaluation function was written
        specifically around the Truth piece and the wider board:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>
          <strong>Game-phase awareness.</strong> A middlegame king-safety term penalizes an exposed king
          and rewards a pawn shield, then fades smoothly into an endgame term that instead centralizes
          the king and drives the enemy king toward the edge and corner to deliver mate.
        </li>
        <li>
          <strong>Truth hunt.</strong> Because a Truth can only be captured by the enemy king, Veritas
          is rewarded for maneuvering its own king toward the opponent's Truth pieces — the signature
          endgame mechanic of Truth Chess. The closer the king gets, the higher the score.
        </li>
        <li>
          <strong>Truth blockade.</strong> The opening and middlegame reward a Truth planted in front of
          enemy pieces or deep in enemy territory, since it denies squares that almost nothing can
          remove. A Truth that cramps the opponent's development is worth points even when it captures
          nothing.
        </li>
        <li>
          <strong>Contempt and the mating drive.</strong> The side with a material lead is rewarded for
          keeping its queens and rooks, so it retains the firepower to force mate instead of trading down
          to a lifeless draw. This contempt term is scaled by what the engine has learned about
          aggression from its own games.
        </li>
        <li>
          <strong>Hanging-piece and hanging-check safety.</strong> Veritas detects pieces attacked by
          weaker enemies and penalizes giving them up for free — and it specifically punishes a "hanging
          check," where a piece checks the enemy king but is undefended and close enough for the king to
          simply capture it. The engine won't hand pieces to the king unless it is far enough ahead that
          the sacrifice is clearly winning.
        </li>
      </ul>

      <h3 className="mt-5 text-base font-semibold text-stone-700">An engine that learns from its own games</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        Unlike a fixed-strength engine, Veritas improves over time through several self-learning
        mechanisms, all stored locally on your device (and, where it helps, shared through the
        server-backed mate book):
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>
          <strong>Self-play position memory.</strong> Every AI-driven game records each position, the
          move chosen, and the outcome. Moves that have historically won are promoted to the front of
          the search (and re-verified, not blindly trusted), so Veritas spends its thinking time on
          lines that have actually paid off.
        </li>
        <li>
          <strong>Persistent best-move hints.</strong> The engine remembers its last chosen move for
          each position and seeds the search ordering from it — reaching trusted lines faster, the way
          a transposition-table entry would.
        </li>
        <li>
          <strong>Tunable evaluation weights.</strong> After each self-play game, weights for
          king-safety, contempt, the Truth hunt, center control, and passed pawns nudge toward the side
          that won (bounded so no single term can run away). This is a lightweight form of the
          Texel-style tuning used by competitive engines.
        </li>
        <li>
          <strong>A shared mate book with mirror symmetry.</strong> When Veritas finds a checkmate, it
          records the winning line. On the next game it recognizes known mates instantly — and it tries
          the mirrored wing of the board too, so a mate learned on the queenside is available on the
          kingside without re-solving it.
        </li>
      </ul>

      <h3 className="mt-5 text-base font-semibold text-stone-700">Effectiveness</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        Veritas plays strong, consistent chess at all ten difficulty levels. There is no "easy mode"
        that throws in random blunders — every level uses the full search and quiescence, with higher
        levels simply searching deeper and longer. Because it searches with alpha-beta, a transposition
        table, and quiescence, it reliably avoids one-move blunders and finds short forced mates. The
        Truth-specific terms mean it understands the variant's distinctive ideas — blockading with the
        Truth, hunting the enemy Truth with the king, and keeping major pieces alive to convert a lead —
        rather than treating the new piece as a generic queen. For a casual or intermediate player,
        Veritas at the upper levels is a genuine challenge; for a strong player it provides a solid
        sparring partner that gets sharper the more games are played.
      </p>

      <h3 className="mt-5 text-base font-semibold text-stone-700">Limitations</h3>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>
          <strong>Search depth is browser-bound.</strong> Veritas runs on your device under a hard time
          budget, so it can't match the depth of a server engine running on dozens of cores for minutes.
          Its strength comes from efficient pruning and variant-aware evaluation, not from raw depth.
        </li>
        <li>
          <strong>No opening book or endgame tablebase in the traditional sense.</strong> Veritas uses a
          light opening target system and its own learned mate book, but it does not ship the huge
          opening books or seven-piece tablebases that standard engines rely on. Truly novel positions
          are solved by search, not looked up.
        </li>
        <li>
          <strong>Self-learning is local and gradual.</strong> The tuned weights and learned positions
          improve with play, but the signal is statistical and accumulates over many games. It is not
          trained offline on millions of self-play games the way a modern neural-network engine is.
        </li>
        <li>
          <strong>Evaluation is hand-crafted, not neural.</strong> Veritas uses a hand-written
          evaluation function tuned for Truth Chess, not a deep neural network. That makes it fast and
          transparent, but it can miss the long-horizon, pattern-based judgments a neural net would
          catch — especially in quiet positional positions the Truth's blockade makes unusual.
        </li>
      </ul>

      <h3 className="mt-5 text-base font-semibold text-stone-700">How Veritas differs from Stockfish and other 8×8 engines</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        The engines most players know — <strong>Stockfish</strong>, Leela Chess Zero, Komodo, and the
        classic craft — were all built for the standard 8×8 board. Veritas is not one of them adapted
        to a bigger board; it is a different engine for a different game. The differences go well beyond
        board size:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>
          <strong>Different geometry.</strong> Standard engines hard-code the 64-square board into their
          move generation, attack maps, and indexing. Veritas generates moves for a 90-square, 10×9 grid
          from the ground up, including the wider castling and the longer back rank.
        </li>
        <li>
          <strong>A piece no 8×8 engine knows about.</strong> The Truth has no analogue in standard
          chess, so Stockfish's evaluation has no concept of it. Veritas dedicates whole evaluation
          terms to the Truth — its role as an uncapturable blocker, the king-driven Truth hunt, and the
          special capture rules — that an 8×8 engine simply cannot express.
        </li>
        <li>
          <strong>Different opening phase.</strong> On the 10×9 board the armies start three empty ranks
          apart instead of two, so the opening is more about maneuvering than immediate contact. Veritas
          uses a light opening target system tuned to this longer development distance, rather than the
          book-driven opening play of standard engines.
        </li>
        <li>
          <strong>No inherited theory.</strong> Stockfish benefits from decades of human opening
          theory and endgame tablebases for 8×8 chess — none of which transfer to a 10×9 board with a
          new piece. Veritas must build its own understanding through search and self-play.
        </li>
        <li>
          <strong>Runs entirely in the browser.</strong> Stockfish is a compiled native binary
          (often running server-side on powerful hardware). Veritas is pure JavaScript running on your
          device, so it has no install, no server cost, and no network dependency — at the cost of raw
          computing power.
        </li>
      </ul>
      <p className="mt-3 text-stone-600 leading-relaxed">
        In short, where Stockfish is a mature, deeply-tuned specialist for traditional chess, Veritas is
        a young, variant-native engine: smaller and lighter, but purpose-built for the 10×9 board and
        the Truth piece, and able to grow stronger the more games are played on it.
      </p>
    </section>
  );
}