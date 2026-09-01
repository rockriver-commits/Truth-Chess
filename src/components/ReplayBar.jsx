import React from 'react';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Post-game step-through controls. `index` is null when viewing the live
// (final) position; otherwise it is a 0-based index into the snapshot list.
// The Prev / Next arrows step one move at a time; First / Last jump to the
// ends; Live returns to the final position.
export default function ReplayBar({ index, total, onFirst, onPrev, onNext, onLast, onLive }) {
  const atLive = index === null;
  const label = atLive ? `Live (${total}/${total})` : `${index + 1}/${total}`;
  return (
    <div className="w-full max-w-[620px] mx-auto mt-3 rounded-2xl bg-white/80 ring-1 ring-stone-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Button size="icon" variant="outline" onClick={onFirst} disabled={atLive || index === 0} title="First move">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onPrev} disabled={atLive || index === 0} className="gap-1" title="Previous move">
          <ChevronLeft className="h-4 w-4" />
          <span className="text-xs">Prev</span>
        </Button>
        <span className="text-xs font-mono text-stone-500">{label}</span>
        <Button variant="outline" onClick={onNext} disabled={atLive || index === total - 1} className="gap-1" title="Next move">
          <span className="text-xs">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={onLast} disabled={atLive || index === total - 1} title="Last move">
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="w-full mt-1" onClick={onLive} disabled={atLive}>
        <CircleDot className="h-3.5 w-3.5 mr-1" /> Live
      </Button>
    </div>
  );
}