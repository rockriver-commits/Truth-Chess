import React from 'react';
import { SkipBack, ChevronLeft, ChevronRight, SkipForward, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Post-game step-through controls. `index` is null when viewing the live
// (final) position; otherwise it is a 0-based index into the snapshot list.
export default function ReplayBar({ index, total, onFirst, onPrev, onNext, onLast, onLive }) {
  const atLive = index === null;
  const label = atLive ? `Live (${total}/${total})` : `${index + 1}/${total}`;
  return (
    <div className="w-full max-w-[620px] mx-auto mt-3 rounded-2xl bg-white/80 ring-1 ring-stone-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={onFirst} disabled={atLive || index === 0}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={onPrev} disabled={atLive || index === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs font-mono text-stone-500">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={onNext} disabled={atLive || index === total - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={onLast} disabled={atLive || index === total - 1}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Button size="sm" variant="ghost" className="w-full mt-1" onClick={onLive} disabled={atLive}>
        <CircleDot className="h-3.5 w-3.5 mr-1" /> Live
      </Button>
    </div>
  );
}