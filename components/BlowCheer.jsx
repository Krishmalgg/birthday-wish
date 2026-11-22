"use client";

import { useCallback, useRef, useState } from "react";
import { createCheerTracker } from "@/lib/cheer";

/**
 * Little messages that pop up over the cake while she blows, so it feels
 * like the cake is cheering her on:
 *   too soft       → "Harder!"
 *   strong         → "Keep going!"
 *   nearly out     → "Almost there!"
 *   stopped early  → "Don't stop!"
 * One bubble at a time, ~1.6 s apart, so it never chatters.
 *
 * feed() is called every audio frame; React state only changes when a new
 * message should appear (see lib/cheer.js), so this costs nothing while blowing.
 */
const LINES = {
  soft: ["Harder!", "A little harder!", "Blow stronger!"],
  strong: ["Keep going!", "That's it, keep blowing!"],
  close: ["Almost there!", "Just a bit more!"],
  stopped: ["Don't stop!", "So close! Again!", "One more big blow!"],
};

export function useBlowCheer() {
  const [cheer, setCheer] = useState(null);
  const count = useRef({ n: 0, idx: {} });
  const tracker = useRef(null);

  const pop = useCallback((stage) => {
    const c = count.current;
    const pool = LINES[stage];
    const i = (c.idx[stage] = ((c.idx[stage] ?? -1) + 1) % pool.length);
    c.n += 1;
    setCheer({
      id: c.n,
      text: pool[i],
      tone: stage,
      x: ((c.n * 37) % 56) - 28, // a little to the left or right each time
      tilt: ((c.n * 53) % 10) - 5,
    });
  }, []);

  if (!tracker.current) tracker.current = createCheerTracker(pop);

  const feed = useCallback((level) => tracker.current(level, performance.now()), []);
  const clear = useCallback(() => setCheer(null), []);
  return { cheer, feed, clear };
}

export default function BlowCheer({ cheer }) {
  return (
    <div className="cheer" aria-hidden="true">
      {cheer && (
        <span
          key={cheer.id}
          className={`cheer__bubble cheer__bubble--${cheer.tone}`}
          style={{ "--x": `${cheer.x}px`, "--tilt": `${cheer.tilt}deg` }}
        >
          {cheer.text}
        </span>
      )}
    </div>
  );
}
