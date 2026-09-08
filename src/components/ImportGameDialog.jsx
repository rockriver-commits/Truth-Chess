import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Paste-a-game dialog: the user pastes PGN/SAN text, the parent parses and
// loads it (onSubmit returns an error string, or null on success). The
// textarea keeps its content on error so the paste isn't lost.
export default function ImportGameDialog({ open, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  if (!open) return null;

  function handleLoad() {
    const err = onSubmit(text);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setText('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <p className="text-lg font-semibold text-stone-800">Import game</p>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-3">
          Paste the game notation (PGN or a move list). The game is recreated on
          the board and Zveritas plays the next move — you take the other color.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'1. f4 b6 2. f5 a6 3. ...'}
          className="font-mono text-xs min-h-[140px]"
        />
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={!text.trim()}>
            Load game
          </Button>
        </div>
      </div>
    </div>
  );
}