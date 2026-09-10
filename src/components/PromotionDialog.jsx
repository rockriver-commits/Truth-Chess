import React from 'react';

const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };

// The pawn-promotion picker overlay: choose Queen, Rook, Bishop, Knight, or a
// Truth piece. `promo` is { move, color }; `onChoose(type)` commits it.
export default function PromotionDialog({ promo, onChoose }) {
  if (!promo) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[300px]">
        <p className="text-center text-sm font-medium text-stone-600 mb-4">Promote pawn to:</p>
        <div className="grid grid-cols-5 gap-2">
          {['Q', 'R', 'B', 'N', 'T'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChoose(t)}
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
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}