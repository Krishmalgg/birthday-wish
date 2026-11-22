"use client";

import { useEffect, useState } from "react";

const NoteIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M9 17.5V6.2a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 20 3.95V15.5a2.5 2.5 0 1 1-2-2.45V7.3l-7 1.75v8.45A2.5 2.5 0 1 1 9 17.5Z" />
  </svg>
);

/**
 * Karaoke line above the cake: shows the line being sung, words lighting up
 * in time with the music box. When the song ends, offers to play it again.
 *
 * player.elapsed() → seconds into the song (null when stopped).
 */
export default function SongLyrics({ song, player, runId, done, onEnd, onReplay }) {
  const [pos, setPos] = useState({ line: 0, word: 0 });

  useEffect(() => {
    if (!player || done || !runId) return;
    let raf = 0;
    const tick = () => {
      const e = player.elapsed();
      if (e == null) return;
      if (e > song.duration + 0.8) {
        onEnd?.();
        return;
      }
      let line = 0;
      while (line < song.lines.length - 1 && e >= song.lines[line + 1].start) line++;
      const word = song.lines[line].words.filter((w) => e >= w.start).length;
      setPos((p) => (p.line === line && p.word === word ? p : { line, word }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [player, song, runId, done, onEnd]);

  if (!player) return null;

  if (done) {
    return (
      <div className="lyrics">
        <button type="button" className="lyrics__again" onClick={onReplay}>
          <NoteIcon />
          Play the song again
        </button>
      </div>
    );
  }

  const { words } = song.lines[pos.line];
  return (
    <div className="lyrics" aria-hidden="true">
      <p className="lyrics__line" key={pos.line}>
        <span className="lyrics__note">
          <NoteIcon />
        </span>
        {words.map((w, i) => (
          <span
            key={i}
            className={`lyrics__word${i < pos.word ? " is-sung" : ""}${i === pos.word - 1 ? " is-now" : ""}`}
          >
            {w.text}
          </span>
        ))}
      </p>
    </div>
  );
}
