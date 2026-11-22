"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BURST } from "@/lib/config";
import { ordinal } from "@/lib/age";
import { celebrateConfetti } from "@/lib/confetti";

const STARS = Array.from({ length: 14 }, (_, i) => ({
  a: `${(i / 14) * 360 + (i % 2) * 11}deg`,
  r: `${-(28 + (i % 3) * 9)}vmin`,
  d: `${(i % 4) * 0.06}s`,
  s: `${12 + (i % 3) * 6}px`,
}));

/**
 * Full-screen "Happy 21st / Birthday, <name>" moment after the candles go out,
 * with the one confetti burst of the celebration, then hands back to the cake
 * page. Plays BURST.video if that file exists, otherwise a built-in animation.
 * Tapping anywhere skips it.
 */
export default function BirthdayBurst({ name, turning, onDone }) {
  const [mode, setMode] = useState("probe"); // probe | video | anim
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    setTimeout(onDone, 600);
  }, [onDone]);

  /* Is there a video to play? */
  useEffect(() => {
    let alive = true;
    fetch(BURST.video, { method: "HEAD" })
      .then((r) => {
        const isVideo = r.ok && (r.headers.get("content-type") || "").startsWith("video");
        if (alive) setMode(isVideo ? "video" : "anim");
      })
      .catch(() => alive && setMode("anim"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode === "anim") {
      const pop = setTimeout(() => celebrateConfetti(), 650);
      const end = setTimeout(finish, BURST.durationMs);
      return () => {
        clearTimeout(pop);
        clearTimeout(end);
      };
    }
    if (mode === "video") {
      const pop = setTimeout(() => celebrateConfetti(), 300); // a timer, so it can only fire once
      const cap = setTimeout(finish, 60000); // never get stuck on a long video
      return () => {
        clearTimeout(pop);
        clearTimeout(cap);
      };
    }
  }, [mode, finish]);

  const ord = ordinal(turning);
  const suffix = ord.slice(String(turning).length);

  return (
    <div
      className={`burst ${leaving ? "burst--out" : ""}`}
      role="dialog"
      aria-label={`Happy ${ord} birthday, ${name}`}
      onClick={finish}
    >
      {mode === "video" && (
        <video
          className="burst__video"
          src={BURST.video}
          autoPlay
          playsInline
          onEnded={finish}
          onError={() => setMode("anim")}
        />
      )}

      {mode === "anim" && (
        <div className="burst__stage">
          <span className="burst__ring" />
          <span className="burst__ring burst__ring--b" />
          {STARS.map((s, i) => (
            <span
              key={i}
              className="burst__star"
              style={{ "--a": s.a, "--r": s.r, "--d": s.d, width: s.s, height: s.s }}
            />
          ))}
          <p className="burst__happy">Happy</p>
          <p className="burst__num">
            {turning}
            <span className="burst__suffix">{suffix}</span>
          </p>
          <p className="burst__line">Birthday, {name}</p>
        </div>
      )}

      <span className="burst__skip">Tap to continue</span>
    </div>
  );
}
