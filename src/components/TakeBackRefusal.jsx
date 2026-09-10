import React from 'react';
import { motion } from 'framer-motion';

// Zveritas' take-back refusal: an orange-and-yellow smiley with the message.
// Rendered over the board with pointer events off, so the parent clears it on
// any board click (or after 10 seconds) and play simply continues.
export default function TakeBackRefusal() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl pointer-events-none">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl shadow-2xl px-6 py-5 flex flex-col items-center gap-2 max-w-[260px] text-center"
      >
        <svg viewBox="0 0 48 48" className="w-14 h-14" aria-hidden="true">
          <defs>
            <radialGradient id="tbSmiley" cx="0.35" cy="0.3" r="0.95">
              <stop offset="0" stopColor="#fde047" />
              <stop offset="0.55" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#ea580c" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="21" fill="url(#tbSmiley)" stroke="#c2410c" strokeWidth="1.5" />
          <circle cx="16" cy="19" r="2.6" fill="#7c2d12" />
          <circle cx="32" cy="19" r="2.6" fill="#7c2d12" />
          <path d="M13 30 Q24 39 35 30" fill="none" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-semibold text-stone-800">
          Can't do it, sorry — I'm in a losing position right now.
        </p>
        <p className="text-[0.65rem] text-stone-400">Click the board to keep playing</p>
      </motion.div>
    </div>
  );
}