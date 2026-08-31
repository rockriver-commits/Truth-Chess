import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Shown to logged-out visitors in place of the game board: play requires a
// free account (which also collects the player's email for the owner's list).
export default function RegisterToPlayCard() {
  return (
    <div className="max-w-md mx-auto rounded-2xl bg-white/80 backdrop-blur ring-1 ring-stone-200 shadow-sm p-8 text-center space-y-4">
      <h2 className="text-2xl font-display font-semibold text-stone-800">Register to play</h2>
      <p className="text-sm text-stone-500 leading-relaxed">
        Create a free account to start playing. Truth Chess is free for everyone — all modes and
        AI levels are open. If you'd like, donate $5 to support development.
      </p>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link to="/register"><Button className="w-full">Create account</Button></Link>
        <Link to="/login"><Button variant="outline" className="w-full">Sign in</Button></Link>
      </div>
    </div>
  );
}