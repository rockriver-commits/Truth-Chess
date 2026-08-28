import React from 'react';

// Board color themes + piece glyph style picker. Persisted by the parent via
// localStorage. Inline to keep the Game controls card self-contained.
const BOARD_THEMES = {
  classic: { light: '#fafaf9', dark: '#d6d3d1', name: 'Classic' },
  walnut: { light: '#f0e6d2', dark: '#b08765', name: 'Walnut' },
  green: { light: '#eeeed2', dark: '#769656', name: 'Green' },
  blue: { light: '#dee3e6', dark: '#8ca2ad', name: 'Blue' },
};

export const BOARD_THEME_KEYS = Object.keys(BOARD_THEMES);

export function getBoardTheme(key) {
  return BOARD_THEMES[key] || BOARD_THEMES.classic;
}

export default function ThemePicker({ boardTheme, pieceStyle, onBoardTheme, onPieceStyle }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Board color</p>
        <div className="grid grid-cols-4 gap-1.5">
          {BOARD_THEME_KEYS.map((key) => {
            const t = BOARD_THEMES[key];
            const active = boardTheme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onBoardTheme(key)}
                className={`rounded-lg p-1 ring-1 transition ${active ? 'ring-amber-500' : 'ring-stone-200'}`}
                title={t.name}
              >
                <div className="h-5 w-full rounded overflow-hidden flex">
                  <div className="flex-1" style={{ backgroundColor: t.light }} />
                  <div className="flex-1" style={{ backgroundColor: t.dark }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-1.5">Piece style</p>
        <div className="grid grid-cols-2 gap-1.5">
          {['figurine', 'letter'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPieceStyle(s)}
              className={`py-1.5 text-xs font-medium rounded-lg ring-1 transition ${
                pieceStyle === s ? 'bg-stone-800 text-white ring-stone-800' : 'bg-white text-stone-600 ring-stone-200'
              }`}
            >
              {s === 'figurine' ? 'Figurine' : 'Letters'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}