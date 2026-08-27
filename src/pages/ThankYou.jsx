import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// Public return route after a Wix checkout. The order_approved webhook fires
// asynchronously and is the source of truth for the plan flip, so we poll the
// user's profile for a few seconds and show a pending state meanwhile.
export default function ThankYou() {
  const [plan, setPlan] = useState(null);
  const [done, setDone] = useState(false);
  const countRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const me = await base44.auth.me();
        if (active) setPlan(me?.plan || null);
        if (me?.plan === 'pro') {
          if (active) setDone(true);
          return;
        }
      } catch {
        // not logged in yet — keep polling
      }
      countRef.current += 1;
      if (countRef.current < 15) setTimeout(tick, 2000);
    };
    tick();
    return () => {
      active = false;
    };
  }, []);

  const isPro = plan === 'pro';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-100 to-amber-50/40 px-4">
      <div className="max-w-md w-full text-center rounded-2xl bg-white/80 ring-1 ring-stone-200 shadow-sm p-8">
        {isPro || done ? (
          <>
            <p className="text-3xl mb-2">🎉</p>
            <h1 className="text-2xl font-semibold text-stone-800">You're Pro!</h1>
            <p className="text-sm text-stone-500 mt-2 mb-6">
              All AI levels and unlimited online play are unlocked.
            </p>
            <Button onClick={() => navigate('/')}>Start playing</Button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mb-4" />
            <h1 className="text-xl font-semibold text-stone-800">Confirming your upgrade…</h1>
            <p className="text-sm text-stone-500 mt-2 mb-6">
              This usually takes a few seconds. Your Pro access will activate automatically once
              payment is confirmed.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to game
            </Button>
          </>
        )}
      </div>
    </div>
  );
}