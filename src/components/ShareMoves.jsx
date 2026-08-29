import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toPGN } from '@/lib/chessNotation';

// Copy / email the current game's moves (PGN). Email opens the user's mail
// client with the PGN prefilled so they can address it to themselves.
export default function ShareMoves({ sans, resultStr, locked = false, onLocked }) {
  const [copied, setCopied] = useState(false);
  const pgn = toPGN(sans || [], resultStr || '*');

  async function copy() {
    if (locked) { onLocked?.(); return; }
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  function email() {
    if (locked) { onLocked?.(); return; }
    const subject = encodeURIComponent('My Truth Chess Game');
    const body = encodeURIComponent(pgn);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="w-full max-w-[620px] mx-auto flex gap-2">
      <Button size="sm" variant="outline" onClick={copy} className="flex-1">
        {locked ? '🔒 Copy moves' : copied ? 'Copied!' : 'Copy moves'}
      </Button>
      <Button size="sm" variant="outline" onClick={email} className="flex-1">
        {locked ? '🔒 Email moves' : 'Email moves'}
      </Button>
    </div>
  );
}