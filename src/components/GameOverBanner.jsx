import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Overlay shown over the board when a game ends in checkmate, stalemate, or a
// draw. Click anywhere on the banner to dismiss it and see the final board
// clearly; it resets (reappears) when a new result comes in.
export default function GameOverBanner({ title, subtitle }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [title, subtitle]);
  if (dismissed) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
      <motion.div
        onClick={() => setDismissed(true)}
        className="px-4 py-2 rounded-xl bg-black/25 text-center cursor-pointer hover:bg-black/35 transition-colors"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [1, 1.06, 1], opacity: 1 }}
        transition={{
          scale: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' },
          opacity: { duration: 0.25 },
        }}
      >
        <motion.p
          className="text-lg sm:text-xl font-display font-bold tracking-tight text-amber-300"
          animate={{
            textShadow: [
              '0 0 5px rgba(252,211,77,0.4)',
              '0 0 10px rgba(252,211,77,0.7)',
              '0 0 5px rgba(252,211,77,0.4)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
        >
          {title}!
        </motion.p>
        {subtitle && (
          <p className="mt-0.5 text-[0.7rem] font-medium text-white/70">{subtitle}</p>
        )}
        <p className="mt-1 text-[0.6rem] font-medium text-white/50">tap to dismiss</p>
      </motion.div>
    </div>
  );
}