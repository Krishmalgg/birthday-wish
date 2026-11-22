"use client";

import { useEffect, useRef, useState } from "react";
import { timeUntil } from "@/lib/age";

const pad = (n) => String(n).padStart(2, "0");

/** Days / hours / minutes / seconds until `target`; calls onComplete once at zero. */
export default function Countdown({ target, onComplete }) {
  const [left, setLeft] = useState(() => timeUntil(target));
  const done = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = timeUntil(target);
      setLeft(next);
      if (next.total <= 0 && !done.current) {
        done.current = true;
        onComplete?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onComplete]);

  const units = [
    { value: pad(left.days), label: left.days === 1 ? "day" : "days" },
    { value: pad(left.hours), label: "hours" },
    { value: pad(left.minutes), label: "min" },
    { value: pad(left.seconds), label: "sec" },
  ];

  return (
    <div className="clock" role="timer" aria-live="off">
      {units.map((u) => (
        <div key={u.label} className="clock__cell">
          <b className="clock__value">{u.value}</b>
          <span className="clock__label">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
