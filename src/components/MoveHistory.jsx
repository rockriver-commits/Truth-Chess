import React, { useEffect, useRef } from 'react';

// Numbered move list in algebraic notation, two plies per row.
export default function MoveHistory({ sans }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [sans]);

  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1] || '' });
  }

  return (
    <div className="w-full max-w-[620px] mx-auto mt-3 rounded-2xl bg-white/70 ring-1 ring-stone-200 p-3">
      <p className="text-[0.65rem] uppercase tracking-widest text-stone-400 mb-2">Moves</p>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">No moves yet.</p>
      ) : (
        <div ref={scrollRef} className="max-h-40 overflow-y-auto pr-1">
          <table className="w-full text-sm font-mono">
            <tbody>
              {rows.map((row) => (
                <tr key={row.n} className="odd:bg-stone-50">
                  <td className="w-8 text-stone-400 pr-2">{row.n}.</td>
                  <td className="text-stone-700 pr-2">{row.w}</td>
                  <td className="text-stone-700">{row.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}