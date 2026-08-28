import React from 'react';
import { motion } from 'framer-motion';

// Flashy overlay shown over the board when a game ends in checkmate, stalemate,
// or a draw. Pulsing scale + glowing text. pointer-events-none so it never
// blocks the board underneath.
export default function GameOverBanner({ title, subtitle }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
      <motion.div
        className="px-6 py-4 rounded-2xl bg-black/55 backdrop-blur-sm text-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
        transition={{
          scale: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' },
          opacity: { duration: 0.25 },
        }}
      >
        <motion.p
          className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-amber-300"
          animate={{
            textShadow: [
              '0 0 8px rgba(252,211,77,0.6)',
              '0 0 20px rgba(252,211,77,0.95)',
              '0 0 8px rgba(252,211,77,0.6)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
        >
          {title}!
        </motion.p>
        {subtitle && (
          <p className="mt-1 text-sm font-medium text-white/90">{subtitle}</p>
        )}
      </motion.div>
    </div>
  );
}