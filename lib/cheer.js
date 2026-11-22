/**
 * Decides when to pop up a cheering message while she blows. Fed every audio
 * frame with { strength, blowing, progress } from the blow detector; calls
 * onShow(stage) only when a new message should appear:
 *
 *   "soft"    breath she can feel but not strong enough to count
 *   "strong"  strong enough — progress is building
 *   "close"   more than half way
 *   "stopped" was getting there, then let go
 *
 * A stage has to last a moment before it's announced (one noisy frame or a
 * word doesn't count). Only one message at a time: they're at least GAP ms
 * apart (as long as one bubble is on screen), and while she keeps doing the
 * same thing its message repeats only every REPEAT ms.
 */
const GAP = 1600;
const REPEAT = 2600;

export function createCheerTracker(onShow) {
  const s = { stage: "idle", since: 0, episode: 0, shownAt: -1e9, shownEpisode: -1, last: null, peak: 0 };

  const show = (stage, now) => {
    s.last = stage;
    s.shownAt = now;
    s.shownEpisode = s.episode;
    onShow(stage);
  };

  return function feed({ strength = 0, blowing = false, progress = 0 }, now) {
    // was getting there, then let go: say so as soon as there's room
    if (blowing) s.peak = Math.max(s.peak, progress);
    else if (s.peak > 0.3 && progress < s.peak - 0.12) {
      if (now - s.shownAt >= GAP) {
        s.peak = 0;
        s.episode += 1;
        show("stopped", now);
      }
      return;
    }

    const stage = blowing ? (progress > 0.35 ? "close" : "strong") : strength > 0.55 ? "soft" : "idle"; // only a real breath, not talking
    if (stage !== s.stage) {
      s.stage = stage;
      s.since = now;
      s.episode += 1;
    }
    if (stage === "idle") return;
    if (now - s.since < (stage === "soft" ? 300 : 60)) return;
    const sameAgain = stage === s.last && s.shownEpisode === s.episode;
    if (now - s.shownAt < (sameAgain ? REPEAT : GAP)) return;
    show(stage, now);
  };
}
