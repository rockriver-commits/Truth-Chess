import React from 'react';

// The TruthMaidenChess guide — a counterpart to TruthGuide, tailored to the
// hidden Maiden variant. Adds the Maiden piece rules and Maiden-flavored
// strategy while keeping the engine and FAQ content players expect.
function H2({ children }) {
  return <h2 className="mt-10 text-xl font-display font-semibold text-stone-800">{children}</h2>;
}

export default function MaidenGuide() {
  return (
    <section className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-6 sm:p-8">
      <header className="mb-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-600/80">
          A Chess Variant
        </p>
        <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight text-stone-800">
          TruthMaidenChess — A Complete Guide
        </h2>
        <p className="mt-2 text-stone-500">
          The 10×9 board, the Truth piece, and the Maiden — plus how to win with all three.
        </p>
      </header>

      <H2>What is TruthMaidenChess?</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        TruthMaidenChess is a hidden variant of Truth Chess played on the same expanded{' '}
        <strong>10-file by 9-rank</strong> board. It keeps every standard chess rule — castling, en passant,
        pawn promotion, check and checkmate — and adds two original pieces: the <strong>Truth</strong> and
        the <strong>Maiden</strong>. The Truth reshapes how you attack and blockade; the Maiden adds a slow,
        nearly uncapturable hunter that can walk the whole board to reach the enemy Truth. Together they
        make for a quieter, more maneuvering game where positioning a single piece can decide the outcome.
      </p>

      <H2>The board and starting position</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The board has ten files (<em>a</em>–<em>j</em>) and nine ranks, with three empty buffer ranks between
        the two armies. Each side's back rank is <strong>R N B T Q K T B N R</strong>, with a pawn in front
        of every back-rank piece and a full row of ten pawns on the second rank.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        In Maiden mode the four corner pawns are replaced by <strong>Maids</strong>: White gets a Maiden on{' '}
        <em>a2</em> and <em>j2</em>, Black gets a Maiden on <em>a8</em> and <em>j8</em>. The Maids start on the
        corners and can step inward from the very first move.
      </p>

      <H2>How the pieces move</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Every standard piece moves as in orthodox chess. Pawns step forward, capture diagonally, and promote
        on the last rank; knights jump, bishops run diagonals, rooks run files and ranks, the queen combines
        rook and bishop, and the king moves one square in any direction. Castling, en passant, the 50-move
        rule, and threefold repetition all apply. The only new movers are the Truth and the Maiden, below.
      </p>

      <H2>The Truth piece</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The Truth moves like a queen — sliding any number of squares along files, ranks, and diagonals. Its
        capture rules are what make it unique:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>The Truth captures <strong>only the opposing Truth</strong>. Every other enemy piece blocks it.</li>
        <li>
          The Truth can be captured only by the <strong>opposing king</strong> or the <strong>opposing
          Truth</strong> — and, in Maiden mode, by the <strong>opposing Maiden</strong>. No other piece can
          take it.
        </li>
        <li>
          Although it does not capture ordinary pieces, the Truth <strong>controls</strong> every square it
          slides through, so it can deliver <strong>check</strong> and <strong>checkmate</strong>.
        </li>
      </ul>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The Truth is free to move from the first move, just like any other piece. Because it is both mobile
        and almost impossible to remove, it is active from the opening onward.
      </p>

      <H2>The Maiden piece</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The Maiden is the signature piece of this variant. She moves <strong>one square in any
        direction</strong>, exactly like a king — but her capture rules mirror the Truth's:
      </p>
      <ul className="mt-3 space-y-2 text-stone-600 leading-relaxed list-disc pl-5">
        <li>The Maiden captures <strong>only the opposing Truth</strong>. She cannot take any other piece.</li>
        <li>
          The Maiden can be captured <strong>only by the opposing Truth</strong>. Not even the enemy king can
          take her — she is safe from every piece except the opposing Truth.
        </li>
        <li>
          She does not give check (only the Truth and standard pieces do), so she cannot deliver checkmate
          directly. Her power is positional: she is a slow, unstoppable walker that can cross the board to
          reach and capture the enemy Truth.
        </li>
      </ul>
      <p className="mt-3 text-stone-600 leading-relaxed">
        Because the Maiden and the Truth are each other's only predators, the two pieces form a closed loop:
        the Truth hunts the Truth, the Maiden hunts the Truth, and only the Truth can stop a Maiden. Every
        game eventually turns on this triangle — who can bring their Maiden (or their king) to the enemy Truth
        first, while keeping their own Truth out of reach.
      </p>

      <H2>Special moves: castling, en passant, promotion</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Castling</strong> works as in standard chess, adjusted for the wider board: the king slides
        two squares toward a rook and the rook jumps to the king's other side. <strong>En passant</strong> is
        unchanged. <strong>Promotion</strong> occurs when a pawn reaches the last rank; in Maiden mode you may
        choose a queen, rook, bishop, knight, a Truth, or a <strong>Maiden</strong> — so a single passed pawn
        can become a second Maiden late in the game.
      </p>

      <H2>Check, checkmate, and the Truth</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        A king is in check when an enemy piece attacks its square. The Truth on an open line can check the
        king from a distance, and since almost nothing can capture it, the only escapes are to move the king,
        block the line, or capture the Truth with your own king or Truth. The Maiden cannot give check, so she
        is never the piece that delivers mate — but she can clear the path for the piece that does by removing
        the enemy Truth. Checkmate is reached when the side to move is in check and has no legal reply;
        stalemate is a draw, as in standard chess.
      </p>

      <H2>Strategy guide</H2>
      <h3 className="mt-5 text-base font-semibold text-stone-700">The opening</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        Use the three buffer ranks to develop. Your Maids start on the corners, far from the center, so it
        takes several turns to bring them into play — decide early whether you want to march a Maiden toward
        the enemy Truth or keep her guarding your own. The Truth is active from move one, so you can also use
        it to claim an open line or plant a blockade while the Maids make their slow way inward.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">The Maiden hunt</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        The Maiden's job is to reach the enemy Truth. Because she steps only one square at a time and cannot
        be captured by anything but the enemy Truth, she is a committed, slow-moving assassin: once you point
        her at the enemy Truth, she cannot be stopped by ordinary pieces — only the enemy Truth itself can
        take her, and that means the opponent must bring their Truth to her, often on your terms. Use your
        other pieces to clear her path and to deflect the enemy Truth so she arrives unopposed.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">Defending your Truth</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        In Maiden mode your Truth has a new enemy: the opposing Maiden. Keep track of both enemy Maids at all
        times — if one of them gets within a few steps of your Truth and you have no way to bring your own
        Truth or Maiden to counter, your Truth is lost. Parking your own Maiden beside your Truth is a strong
        defensive formation: she cannot be captured by anything but the enemy Truth, and she threatens any
        Truth that approaches.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">Using the Truth as a blocker</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        The Truth's immunity makes it an ideal blockade piece. Planting a Truth in front of an enemy rook or
        on a central square denies that square permanently. This is especially strong in Maiden mode, because
        a well-placed Truth can also shield your own Truth from an approaching Maiden — the Maiden cannot pass
        through the Truth without capturing it, and only the Truth can do that.
      </p>
      <h3 className="mt-5 text-base font-semibold text-stone-700">The endgame</h3>
      <p className="mt-2 text-stone-600 leading-relaxed">
        In the endgame the Maiden–Truth duel becomes decisive. With few pieces left, march your Maiden (and
        your king) toward the enemy Truth while keeping your own Truth out of reach of the enemy Maiden and
        king. A passed pawn that promotes to a second Maiden can be devastating here — two Maids converging
        on a single Truth from different directions are very hard to stop. If you are ahead on Truth-hunters,
        press; if you are behind, trade your Truth for the attacking Maiden to neutralize the threat.
      </p>

      <H2>Frequently asked questions</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Can a pawn capture the Maiden?</strong> No. Only the opposing Truth can capture a Maiden. She
        simply blocks every other piece, including pawns and the enemy king.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Can the Maiden give check?</strong> No. The Maiden controls the square she stands on but does
        not give check, so she cannot checkmate the king directly. Her value is in hunting the Truth and
        clearing the way for your other pieces.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>Can I promote a pawn to a Maiden?</strong> Yes — in Maiden mode, promotion offers Q, R, B, N,
        T (Truth), and M (Maiden). A promoted Maiden is just as uncapturable as a starting one.
      </p>
      <p className="mt-3 text-stone-600 leading-relaxed">
        <strong>What happens if only kings and Maids remain?</strong> The Maids cannot checkmate the king, so
        unless a Maid can reach and capture the enemy Truth to swing the material balance, the game heads
        toward a draw. Push for a promotion or a Truth capture before the position simplifies.
      </p>

      <H2>Inside the engine — Zveritas in Maiden mode</H2>
      <p className="mt-3 text-stone-600 leading-relaxed">
        The AI you play against is <strong>Zveritas</strong>, an engine written from scratch for the Truth
        Chess board and rules. In Maiden mode it extends its move generation and evaluation to the Maiden: it
        knows the Maiden's king-like step, her Truth-only capture, and her Truth-only vulnerability, and its
        evaluation rewards steering Maids toward the enemy Truth while shielding its own. It runs entirely
        in your browser — no server calls, no network dependency — so every move is computed live on your
        device. The same alpha-beta search, transposition table, and quiescence that power standard Truth
        Chess drive Maiden mode, with extra evaluation terms for the Maiden hunt and the Truth–Maiden duel.
      </p>
    </section>
  );
}