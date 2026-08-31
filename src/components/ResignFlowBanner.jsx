import React from 'react';
import { motion } from 'framer-motion';
import { Flag, Check } from 'lucide-react';

// Shown over the board during an AI-vs-AI agreed resignation, so the spectator
// sees both steps: first the lone-king side "offers to resign", then the
// opponent "accepts". `loser` is the resigning color; `phase` is 'offer' then
// 'accepted'. The persistent result is handled by GameOverBanner once the
// game ends.
export default function ResignFlowBanner({ loser, phase }) {
  const loserName = loser === 'w' ? 'White' : 'Black';
  const winnerName = loser === 'w' ? 'Black' : 'White';
  const isOffer = phase === 'offer';
  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex justify-center pointer-events-none px-4"
    >
      <div
        className={`px-5 py-3 rounded-2xl shadow-2xl ring-1 text-center ${
          isOffer ? 'bg-amber-50/95 ring-amber-300' : 'bg-emerald-50/95 ring-emerald-300'
        }`}
      >
        <div className={`flex items-center gap-2 ${isOffer ? 'text-amber-700' : 'text-emerald-700'}`}>
          {isOffer ? <Flag className="w-5 h-5 shrink-0" /> : <Check className="w-5 h-5 shrink-0" />}
          <span className="font-semibold text-sm sm:text-base">
            {isOffer
              ? `${loserName} offers to resign`
              : `${winnerName} accepts — ${winnerName} wins`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}