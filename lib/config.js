/**
 * Everything configurable lives here. The person's details come from .env
 * (see .env.example); URL params ?name= and ?date= still override them, which
 * is handy for testing and for sharing a link with someone else.
 *
 * NOTE: `process.env.NEXT_PUBLIC_*` must be written out literally — Next
 * inlines these exact expressions at build time.
 */

export const PERSON = {
  name: process.env.NEXT_PUBLIC_BIRTHDAY_NAME || "Ridmi",
  dob: process.env.NEXT_PUBLIC_BIRTHDAY_DATE || "2005-11-22",
  // the pet name piped on the cake board ("Happy Birthday Rimmi"); everywhere
  // else uses `name`. Leave empty to use `name` on the board too.
  cakeName: process.env.NEXT_PUBLIC_CAKE_NAME ?? "Rimmi",
};

export const COPY = {
  signature: process.env.NEXT_PUBLIC_SIGNATURE || "With love",
  wish: process.env.NEXT_PUBLIC_WISH || "May this year be as beautiful as you are.",
};

export const WHATSAPP = {
  number: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "94717697494").replace(/\D/g, ""),
  message:
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ||
    "Hi! I just blew out my candles on the birthday page — may I request my gift please?",
};

export const whatsappLink = () =>
  `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(WHATSAPP.message)}`;

/**
 * Cover page. While testing, the "Open your surprise" button works before the
 * birthday too. Set allowEarlyOpen to false before sending the link, so it
 * only opens once the countdown reaches midnight.
 */
export const COVER = {
  allowEarlyOpen: true,
};

/**
 * The "Happy 21st" moment after the candles go out. It's an animation by
 * default; drop a video at this path and it plays instead (tap skips it).
 */
export const BURST = {
  video: "/videos/happy-birthday.mp4",
  durationMs: 5200, // length of the built-in animation
};

/**
 * Photos. `src` is tried first and the generated placeholder is used if it
 * 404s, so you can drop real files in /public/images at any time.
 */
export const HERO = { src: "/images/hero.jpg", fallback: "/images/hero.svg" };

export const GALLERY = [
  { src: "/images/image1.jpg", fallback: "/images/image1.svg", caption: "Where it all began" },
  { src: "/images/image2.jpg", fallback: "/images/image2.svg", caption: "That smile" },
  { src: "/images/image3.jpg", fallback: "/images/image3.svg", caption: "Golden hour" },
  { src: "/images/image4.jpg", fallback: "/images/image4.svg", caption: "Adventures" },
  { src: "/images/image5.jpg", fallback: "/images/image5.svg", caption: "Pure joy" },
  { src: "/images/image6.jpg", fallback: "/images/image6.svg", caption: "Here's to many more" },
];

/**
 * The cake. Drop a cut-out photo at /public/images/cake.png (transparent
 * background, square-ish) and it replaces the drawn cake automatically.
 * `ring` is where the candles stand, in % of the cake's square box — tune
 * these three numbers if you swap in your own photo.
 */
export const CAKE = {
  photo: "/images/cake.png",
  // All in % of the cake's square box, tuned for the lavender cake drawing
  // (top face centred at 44.5%). cy = where the candle bases sit,
  // rx/ry = ring radii for many candles, gap = spacing when in a row.
  ring: { cy: 44.5, rx: 17, ry: 5, gap: 9 },
  rowMax: 5, // drawn cake only: up to this many candles stand in a row, more form a ring
  maxCandles: 5, // a few real-looking candles rather than one per year
};

export const AUDIO = {
  // Optional sound effects for the blow-out. Drop real files in /public/audio
  // and they play; the birthday song itself is built in (lib/song.js).
  party: ["/audio/party.mp3"],
  whoosh: ["/audio/whoosh.mp3"],
  cheer: ["/audio/cheer.mp3"],
};

export const VOLUME = {
  party: 0.5,
  whoosh: 0.9,
  cheer: 0.85,
};

/**
 * Blow detection, on the AnalyserNode byte scale (0–255).
 *
 * By default the trigger level is worked out from the room: the first
 * CALIBRATE_MS are spent measuring background noise, and the trigger sits
 * OVER_ROOM above it (clamped between MIN_TRIGGER and MAX_TRIGGER). Set
 * AUTO_CALIBRATE to false to use the fixed THRESHOLD instead.
 *
 * Too hard to blow out? Lower OVER_ROOM. Set off by chatter? Raise it.
 */
export const BLOW = {
  LOW_BINS: 28, // first N FFT bins ≈ 0–650 Hz
  AUTO_CALIBRATE: true,
  CALIBRATE_MS: 800,
  OVER_ROOM: 55,
  MIN_TRIGGER: 95,
  MAX_TRIGGER: 200,
  THRESHOLD: 140, // only used when AUTO_CALIBRATE is false
  HOLD_MS: 800, // a strong breath must last this long — a puff or a word only makes the flames flicker
  FALLBACK_AFTER_MS: 15000,
};
