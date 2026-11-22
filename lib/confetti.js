let loader;

/** Lazy-load canvas-confetti (it touches `window`, so never at module scope). */
export function warmConfetti() {
  loader ??= import("canvas-confetti").then((m) => m.default);
  return loader;
}

const COLORS = ["#b896de", "#8f68c0", "#f3c23a", "#ffe68a", "#fff3dc", "#9cc069", "#ffffff"];

/** One celebration: a single burst from both sides at once (no second wave). */
export async function celebrateConfetti() {
  const confetti = await warmConfetti();
  const base = { zIndex: 120, colors: COLORS, disableForReducedMotion: true, ticks: 220 };

  confetti({ ...base, particleCount: 190, angle: 60, spread: 75, startVelocity: 62, origin: { x: 0, y: 0.8 } });
  confetti({ ...base, particleCount: 190, angle: 120, spread: 75, startVelocity: 62, origin: { x: 1, y: 0.8 } });
}
