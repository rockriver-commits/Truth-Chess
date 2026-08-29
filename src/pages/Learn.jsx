import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

// AdSense publisher client. The AdSense script is loaded *only* on this content
// page (see the useEffect below), never on the game screen, so Google-served ads
// always appear alongside substantial publisher content — per the AdSense
// Program Policies on "ads on screens without publisher-content".
const ADSENSE_CLIENT = 'ca-pub-3930013508011613';

function H2({ children }) {
  return <h2 className="mt-10 text-xl font-display font-semibold text-stone-800">{children}</h2>;
}

export default function Learn() {
  useEffect(() => {
    if (document.getElementById('adsbygoogle-js')) return;
    const s = document.createElement('script');
    s.id = 'adsbygoogle-js';
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
    // Remove the AdSense loader when leaving the content page so no ads can be
    // served on the game screen during the same SPA session.
    return () => {
      s.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <Link to="/" className="text-sm text-amber-600 hover:underline">
          ← Back to game
        </Link>

        <header className="mt-4 mb-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-600/80">
            A Chess Variant
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-display font-semibold tracking-tight text-stone-800">
            Truth Chess — A Complete Guide
          </h1>
          <p className="mt-3 text-stone-500">
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
          occurs when a pawn reaches the last rank; you choose a queen, rook, bishop, or knight.
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
          squares your knights and bishops want. Don't rush the Truth forward — it is most useful kept in
          reserve where it can influence several lines at once.
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

        <div className="mt-10 pt-6 border-t border-stone-200">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-stone-800 text-white text-sm font-medium px-4 py-2 hover:bg-stone-900 transition"
          >
            Play Truth Chess →
          </Link>
        </div>
      </div>
    </div>
  );
}