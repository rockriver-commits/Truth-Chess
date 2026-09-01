import React from 'react';

// The Maiden piece glyph — shared by the board and the Maiden-mode launch
// button so the button always shows the exact same piece as on the board.
export default function MaidenGlyph({ color = 'b', className = '', style }) {
  const fill = color === 'w' ? '#f8fafc' : '#1f2937';
  const stroke = color === 'w' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.2)';
  const goldEdge = color === 'w' ? 'rgba(120,80,0,0.5)' : 'rgba(0,0,0,0.4)';
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <polygon points="3.5,23 20.5,23 12,19.5" fill="#f5c518" stroke={goldEdge} strokeWidth="0.3" strokeLinejoin="round" />
      <path
        d="M9 5 C8.4 9 8.6 14 8.8 21 L15.2 21 C15.4 14 15.6 9 15 5 C14.2 6 9.8 6 9 5 Z"
        fill="#f5c518"
        stroke={goldEdge}
        strokeWidth="0.3"
        opacity="0.95"
      />
      <path
        d="M8.5 8 C7.4 10.5 9.6 12.2 10.2 13.2 C10.2 14.2 9 15 8.5 17 C8 19.5 5.5 21 5 23 L19 23 C18.5 21 16 19.5 15.5 17 C15 15 13.8 14.2 13.8 13.2 C14.4 12.2 16.6 10.5 15.5 8 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path d="M8.8 9.2 C9.5 10.8 14.5 10.8 15.2 9.2" fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.5" />
      <circle cx="12" cy="5" r="2.8" fill={fill} stroke={stroke} strokeWidth="0.6" />
      <path d="M9.3 4.6 C8.8 2.5 11 1.5 12 1.5 C13 1.5 15.2 2.5 14.7 4.6 C13.8 3.6 10.2 3.6 9.3 4.6 Z" fill="#f5c518" stroke={goldEdge} strokeWidth="0.25" />
      <circle cx="12" cy="2.3" r="0.95" fill="#facc15" stroke={goldEdge} strokeWidth="0.2" />
    </svg>
  );
}