import React from 'react';

// The Truth piece mark. The default export is the shaded header rendering;
// `TruthMarkInline` is the small plain mark used inline in prose.
export default function TruthPieceIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Truth piece">
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
  );
}

export function TruthMarkInline() {
  return (
    <span className="inline-flex align-middle mx-0.5" title="Truth piece">
      <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block' }}>
        <polygon points="5,23 19,23 12,15" fill="#1f2937" />
        <rect x="10" y="0" width="4" height="23" rx="1.5" fill="#1f2937" />
        <rect x="4" y="6.5" width="16" height="4" rx="1.5" fill="#1f2937" />
        <circle cx="12" cy="8.5" r="2.6" fill="#facc15" />
      </svg>
    </span>
  );
}