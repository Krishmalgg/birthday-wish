/**
 * "Happy Birthday to You" as a little music box, played with the Web Audio
 * API, plus word timings so the lyrics can light up as they're sung.
 * (Melody and lyrics are public domain.)
 *
 * It plays an octave up (G5–G6, ~780–1570 Hz), above the < ~650 Hz band the
 * blow detector listens to, so the song can't blow the candles out by itself.
 */

const BEAT = 0.58; // seconds per beat

const HZ = {
  G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5,
  D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98,
};

/** Each line: words, each word = [text, [[note, beats], ...]] */
function score(name) {
  const happy = ["Happy", [["G5", 0.75], ["G5", 0.25]]];
  return [
    [happy, ["birthday", [["A5", 1], ["G5", 1]]], ["to", [["C6", 1]]], ["you", [["B5", 2]]]],
    [happy, ["birthday", [["A5", 1], ["G5", 1]]], ["to", [["D6", 1]]], ["you", [["C6", 2]]]],
    [happy, ["birthday", [["G6", 1], ["E6", 1]]], ["dear", [["C6", 1]]], [name, [["B5", 1], ["A5", 2]]]],
    [["Happy", [["F6", 0.75], ["F6", 0.25]]], ["birthday", [["E6", 1], ["C6", 1]]], ["to", [["D6", 1.15]]], ["you", [["C6", 3]]]],
  ];
}

/**
 * Timeline for a name: lines → words with start/end (seconds from the first
 * note), plus the flat note list for the synth.
 */
export function buildSong(name) {
  let t = 0;
  const notes = [];
  const lines = score(name).map((words, li) => {
    // a touch slower on the last line, like people actually sing it
    const beat = li === 3 ? BEAT * 1.12 : BEAT;
    const start = t;
    const out = words.map(([text, syllables]) => {
      const wStart = t;
      syllables.forEach(([n, beats]) => {
        notes.push({ t, dur: beats * beat, freq: HZ[n] });
        t += beats * beat;
      });
      return { text, start: wStart, end: t };
    });
    return { words: out, start, end: t };
  });
  return { lines, notes, duration: t };
}

/**
 * Create inside a user gesture (the "Open your surprise" tap) so the browser
 * lets it make sound later. Returns null if Web Audio isn't available.
 */
export function createSongPlayer({ volume = 0.42 } = {}) {
  const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return null;
  const ctx = new Ctx();
  ctx.resume().catch(() => {});

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // a soft echo so it sounds like a music box in a room, not a beep
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.26;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.24;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4200;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(wet);
  wet.connect(master);

  let voice = null; // per-play bus, so a stop can silence notes already scheduled
  let startAt = null;
  let muted = false;

  const newVoice = () => {
    const v = ctx.createGain();
    v.connect(master);
    v.connect(delay);
    return v;
  };

  /** Music-box tine: bright attack, bell-like partials, long natural decay. */
  function tine(bus, freq, at, dur) {
    const partials = [
      [1, 0.5, 1],
      [2, 0.14, 0.45],
      [3.01, 0.045, 0.22],
    ];
    partials.forEach(([mult, amp, life]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      const len = Math.max(0.9, dur * 1.4) * life + 0.15;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + len + 0.05);
    });
  }

  function silence(fadeMs) {
    if (!voice) return;
    const old = voice;
    const now = ctx.currentTime;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    setTimeout(() => old.disconnect(), fadeMs + 100);
    voice = null;
  }

  return {
    /** Schedule the whole song; returns immediately. */
    play(song) {
      ctx.resume().catch(() => {});
      silence(150);
      voice = newVoice();
      const t0 = ctx.currentTime + 0.3;
      song.notes.forEach((n) => tine(voice, n.freq, t0 + n.t, n.dur));
      startAt = t0;
    },

    /** Seconds since the first note (negative just before it), or null if not playing. */
    elapsed() {
      return startAt == null ? null : ctx.currentTime - startAt;
    },

    stop(fadeMs = 600) {
      silence(fadeMs);
      startAt = null;
    },

    setMuted(value) {
      muted = value;
      master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
    },

    dispose() {
      silence(0);
      ctx.close().catch(() => {});
    },
  };
}
