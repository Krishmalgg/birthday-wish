import { AUDIO, VOLUME } from "./config";

/**
 * Optional sound effects. The birthday song itself is the built-in music box
 * (lib/song.js); these only play if you drop mp3s into /public/audio.
 */
function createTrack(sources, { loop = false, volume = 1, onReady } = {}) {
  const el = document.createElement("audio");
  el.preload = "auto";
  el.loop = loop;
  el.volume = volume;
  el.addEventListener("canplay", () => onReady?.(), { once: true });
  for (const src of sources) {
    const source = document.createElement("source");
    source.src = src;
    el.appendChild(source);
  }
  el.load();
  return el;
}

const play = (el) => el.play().catch(() => {});

/** Ramp an element's volume; a newer fade on the same element cancels the old one. */
function fade(el, to, ms, onDone) {
  clearInterval(el._fade);
  const from = el.volume;
  const steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  el._fade = setInterval(() => {
    i += 1;
    el.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
    if (i >= steps) {
      clearInterval(el._fade);
      onDone?.();
    }
  }, 50);
}

/** Create inside a user gesture (the "open" tap) so playback is allowed later. */
export function createAudioManager({ onReady } = {}) {
  let muted = false;
  const ready = () => onReady?.();

  const tracks = {
    party: createTrack(AUDIO.party, { loop: true, volume: 0, onReady: ready }),
    whoosh: createTrack(AUDIO.whoosh, { volume: VOLUME.whoosh, onReady: ready }),
    cheer: createTrack(AUDIO.cheer, { volume: VOLUME.cheer, onReady: ready }),
  };

  return {
    /** Prime the effect tracks (iOS/Safari) while the user gesture is still live. */
    unlock() {
      for (const key of ["party", "whoosh", "cheer"]) {
        const el = tracks[key];
        el.muted = true;
        el.play()
          .then(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = muted;
          })
          .catch(() => {
            el.muted = muted;
          });
      }
    },

    /** Candles out: whoosh, then cheering, then fade in the party track. */
    celebrate() {
      play(tracks.whoosh);
      setTimeout(() => play(tracks.cheer), 900);
      setTimeout(() => {
        tracks.party.currentTime = 0;
        play(tracks.party);
        fade(tracks.party, VOLUME.party, 2500);
      }, 1200);
    },

    setMuted(value) {
      muted = value;
      Object.values(tracks).forEach((el) => (el.muted = value));
    },

    dispose() {
      Object.values(tracks).forEach((el) => {
        clearInterval(el._fade);
        el.pause();
        el.removeAttribute("src");
        el.replaceChildren();
        el.load();
      });
    },
  };
}
