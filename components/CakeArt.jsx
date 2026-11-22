/**
 * Lavender drip cake: cream body, lilac fondant drip, butter-yellow stars,
 * a ribbon band with a big bow, and a macaron / daisy / meringue garnish on top.
 *
 * Drawn on a 400×400 box. The top face is the ellipse (200, 178) 136×30 —
 * the candles (Candles.jsx) stand on it, positioned by CAKE.ring in config.
 * The garnish stays at the left/right rim so it never sits under a candle.
 */

const CX = 200;
const RX = 136;
const TOP = 178; // top face centre y
const BOTTOM = 318; // bottom ellipse centre y
const RY = 30;

const r1 = (n) => Math.round(n * 10) / 10;

/** Point on the front of the cylinder: phi 0 = left edge, PI = right edge. */
const front = (phi, y) => [CX - RX * Math.cos(phi), y + RY * Math.sin(phi)];

/** Fondant drip: wide rounded drips, foreshortened towards the sides. */
function dripPath() {
  const amps = [0.85, 1.1, 0.75, 1.15, 0.8, 1.1, 0.7, 1.05];
  const n = 160;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = t * amps.length;
    const k = Math.min(amps.length - 1, Math.floor(u));
    const bump = Math.pow(Math.sin((u - k) * Math.PI), 1.15);
    const [x, y] = front(t * Math.PI, TOP);
    pts.push(`${r1(x)} ${r1(y + 13 + 27 * amps[k] * bump)}`);
  }
  return `M${CX - RX} ${TOP} L${pts.join(" L")} L${CX + RX} ${TOP} Z`;
}

const DRIP = dripPath();

/** Rounded five-point star (rounding comes from the round-joined stroke). */
function starPoints(R) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.48 : R;
    pts.push(`${r1(Math.cos(a) * r)},${r1(Math.sin(a) * r)}`);
  }
  return pts.join(" ");
}

/* x, y, size, rotation, horizontal squash (stars near the sides turn away) */
const STARS = [
  [104, 258, 13, -8, 0.82],
  [202, 246, 12, 6, 1],
  [292, 266, 13, 14, 0.85],
  [326, 232, 9, -4, 0.5],
  [74, 234, 7, 10, 0.45],
];

const PEARLS = [
  [140, 232], [176, 270], [236, 282], [258, 238], [312, 300], [86, 292],
  [122, 296], [272, 302], [212, 300], [330, 268], [70, 268], [150, 256],
];

const BAND_TOP = BOTTOM - 22;

function Leaf({ x, y, rot = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 0 C6 -9 18 -11 26 -4 C18 4 7 6 0 0 Z" fill="url(#lc-leaf)" />
      <path d="M2 -1 C9 -4 16 -5 23 -4" stroke="#6e9447" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Daisy({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${s * 0.8})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-8" rx="6.4" ry="8.6" fill="url(#lc-petal)" stroke="#eadfcf" strokeWidth=".6"
          transform={`rotate(${a})`} />
      ))}
      <circle r="4.6" fill="#f6c93c" />
      <circle r="4.6" fill="url(#lc-gloss)" />
    </g>
  );
}

function VioletFlower({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${s * 0.82})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <ellipse cx="0" cy="-7.5" rx="5.6" ry="7.6" fill="#a47ccf" />
          <path d="M0 -2 L0 -10" stroke="#8a62b8" strokeWidth=".9" strokeLinecap="round" />
        </g>
      ))}
      <circle r="3.6" fill="#f6c93c" />
    </g>
  );
}

/** Piped meringue kiss. */
function Meringue({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="3" rx="15" ry="5" fill="#d9c6ae" opacity=".5" />
      <path
        d="M-15 2 C-16 -6 -8 -9 -5 -10 C-8 -14 -3 -19 1 -24 C2 -18 6 -15 6 -12 C12 -11 17 -6 15 2 C8 6 -8 6 -15 2 Z"
        fill="url(#lc-cream-swirl)"
      />
      <path d="M-12 -2 C-6 -6 4 -6 13 -2 M-6 -9 C-2 -12 3 -12 6 -10" stroke="#e7d7c0" strokeWidth="1.4"
        fill="none" strokeLinecap="round" />
      <path d="M-8 -3 C-6 -7 -4 -8 -1 -9" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".9" />
    </g>
  );
}

function Macaron({ x, y }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-12)`}>
      <ellipse cx="0" cy="17" rx="27" ry="6" fill="#7a5a84" opacity=".25" />
      {/* bottom shell */}
      <path d="M-27 5 C-27 15 -14 19 0 19 C14 19 27 15 27 5 Z" fill="url(#lc-mac)" />
      {/* cream filling */}
      <path d="M-26 2 C-26 7 26 7 26 2 L26 6 C26 11 -26 11 -26 6 Z" fill="#fbf0dc" />
      <rect x="-26" y="0" width="52" height="6" rx="3" fill="#fbf0dc" />
      {/* top shell */}
      <path d="M-28 1 C-28 -16 -14 -22 0 -22 C14 -22 28 -16 28 1 C18 5 -18 5 -28 1 Z" fill="url(#lc-mac)" />
      {/* ruffled feet */}
      <path d="M-27 1 C-18 4.5 18 4.5 27 1" stroke="#9673bf" strokeWidth="2.6" strokeDasharray="1.2 1.8"
        fill="none" strokeLinecap="round" />
      <path d="M-26 9 C-18 11.5 18 11.5 26 9" stroke="#9673bf" strokeWidth="2.4" strokeDasharray="1.2 1.8"
        fill="none" strokeLinecap="round" />
      <ellipse cx="-10" cy="-13" rx="9" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-10 -10 -13)" />
    </g>
  );
}

export default function CakeArt() {
  return (
    <svg
      className="cake-art"
      viewBox="0 0 400 400"
      role="img"
      aria-label="Lavender birthday cake with a bow, stars and flowers"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Cream sponge body: warm, rounded by side shading */}
        <linearGradient id="lc-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e7d3bb" />
          <stop offset=".18" stopColor="#f8ebd8" />
          <stop offset=".45" stopColor="#fff8ec" />
          <stop offset=".72" stopColor="#fbf0df" />
          <stop offset=".92" stopColor="#ecdac3" />
          <stop offset="1" stopColor="#dcc6ac" />
        </linearGradient>

        {/* Lilac fondant */}
        <linearGradient id="lc-drip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f6cbc" />
          <stop offset=".2" stopColor="#b08cd8" />
          <stop offset=".45" stopColor="#c0a0e2" />
          <stop offset=".75" stopColor="#b28fd9" />
          <stop offset="1" stopColor="#8c68b9" />
        </linearGradient>
        <radialGradient id="lc-top" cx=".5" cy=".55" r=".6">
          <stop offset="0" stopColor="#cdb2ea" />
          <stop offset=".7" stopColor="#bc9ce1" />
          <stop offset="1" stopColor="#ad8bd6" />
        </radialGradient>
        <radialGradient id="lc-candleglow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff1c8" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff1c8" stopOpacity="0" />
        </radialGradient>

        {/* Ribbon */}
        <linearGradient id="lc-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8562b2" />
          <stop offset=".25" stopColor="#a985d4" />
          <stop offset=".5" stopColor="#b796de" />
          <stop offset=".75" stopColor="#a681d1" />
          <stop offset="1" stopColor="#8160ad" />
        </linearGradient>
        <linearGradient id="lc-bow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4a6e6" />
          <stop offset=".55" stopColor="#ab88d6" />
          <stop offset="1" stopColor="#9372c2" />
        </linearGradient>
        <linearGradient id="lc-tail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b78c8" />
          <stop offset="1" stopColor="#b493dc" />
        </linearGradient>

        {/* Plate */}
        <radialGradient id="lc-plate" cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".75" stopColor="#f8f2f5" />
          <stop offset="1" stopColor="#ece2e8" />
        </radialGradient>
        <linearGradient id="lc-plate-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9cbd5" />
          <stop offset=".45" stopColor="#f1e9ee" />
          <stop offset="1" stopColor="#d4c4cf" />
        </linearGradient>

        {/* Garnish */}
        <linearGradient id="lc-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe68a" />
          <stop offset="1" stopColor="#f3c23a" />
        </linearGradient>
        <radialGradient id="lc-pearl" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#ead7bb" />
        </radialGradient>
        <linearGradient id="lc-leaf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7ea64f" />
          <stop offset="1" stopColor="#a5c873" />
        </linearGradient>
        <radialGradient id="lc-petal" cx=".5" cy=".8" r=".9">
          <stop offset="0" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#f6ecdf" />
        </radialGradient>
        <radialGradient id="lc-gloss" cx=".35" cy=".3" r=".6">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lc-cream-swirl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#f1e2cb" />
        </linearGradient>
        <radialGradient id="lc-mac" cx=".38" cy=".3" r=".85">
          <stop offset="0" stopColor="#c7aae8" />
          <stop offset="1" stopColor="#9673bf" />
        </radialGradient>

        <filter id="lc-blur3" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="lc-blur8" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="8" /></filter>

        <clipPath id="lc-body-clip">
          <path d={`M${CX - RX} ${TOP} V${BOTTOM} A${RX} ${RY} 0 0 0 ${CX + RX} ${BOTTOM} V${TOP} Z`} />
        </clipPath>
      </defs>

      {/* ── Ground shadow + plate ── */}
      <ellipse cx="200" cy="384" rx="176" ry="12" fill="#6e5577" opacity=".28" filter="url(#lc-blur8)" />
      <path d="M22 334 V344 A178 40 0 0 0 378 344 V334 Z" fill="url(#lc-plate-side)" />
      <ellipse cx="200" cy="334" rx="178" ry="40" fill="url(#lc-plate)" />
      <ellipse cx="200" cy="334" rx="176" ry="39" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".9" />
      <ellipse cx="200" cy="326" rx="146" ry="32" fill="#7d6487" opacity=".22" filter="url(#lc-blur8)" />

      {/* ── Cream body ── */}
      <path d={`M${CX - RX} ${TOP} V${BOTTOM} A${RX} ${RY} 0 0 0 ${CX + RX} ${BOTTOM} V${TOP} Z`} fill="url(#lc-body)" />

      <g clipPath="url(#lc-body-clip)">
        {/* warm candle light on the front */}
        <ellipse className="cake-art__warm" cx="200" cy="232" rx="110" ry="40" fill="#fff6dc" opacity=".55" filter="url(#lc-blur8)" />
        {/* soft shadow the drip throws on the sponge */}
        <path d={DRIP} transform="translate(0 5)" fill="#a0806a" opacity=".22" filter="url(#lc-blur3)" />

        {/* pearls */}
        {PEARLS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y + 1} r="3.6" fill="#c9b090" opacity=".35" />
            <circle cx={x} cy={y} r="3.4" fill="url(#lc-pearl)" />
          </g>
        ))}

        {/* stars */}
        {STARS.map(([x, y, s, rot, sq]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${sq} 1) rotate(${rot})`}>
            <polygon points={starPoints(s)} transform="translate(0 2)" fill="#c99a2a" opacity=".3"
              stroke="#c99a2a" strokeWidth="4" strokeLinejoin="round" />
            <polygon points={starPoints(s)} fill="url(#lc-star)" stroke="#f3c94a" strokeWidth="4" strokeLinejoin="round" />
            <polygon points={starPoints(s * 0.45)} transform={`translate(${-s * 0.15} ${-s * 0.2})`}
              fill="#fff" opacity=".35" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          </g>
        ))}
      </g>

      {/* ── Ribbon band ── */}
      <path
        d={`M${CX - RX} ${BAND_TOP} A${RX} ${RY} 0 0 0 ${CX + RX} ${BAND_TOP} V${BOTTOM} A${RX} ${RY} 0 0 1 ${CX - RX} ${BOTTOM} Z`}
        fill="url(#lc-band)"
      />
      <path d={`M${CX - RX} ${BAND_TOP} A${RX} ${RY} 0 0 0 ${CX + RX} ${BAND_TOP}`} stroke="#d2bbef"
        strokeWidth="1.6" fill="none" opacity=".8" />

      {/* ── Fondant drip + top face ── */}
      <path d={DRIP} fill="url(#lc-drip)" />
      <path d={DRIP} fill="none" stroke="#9a78c4" strokeWidth="1" opacity=".5" />
      <ellipse cx={CX} cy={TOP} rx={RX} ry={RY} fill="url(#lc-top)" />
      <ellipse cx={CX} cy={TOP + 1} rx={RX - 2} ry={RY - 1} fill="none" stroke="#d8c3f1" strokeWidth="2" opacity=".7" />
      <ellipse className="cake-art__glow" cx={CX} cy={TOP - 2} rx="88" ry="22" fill="url(#lc-candleglow)" />

      {/* ── Garnish: left rim ── */}
      <Leaf x={86} y={160} rot={-150} s={0.95} />
      <Leaf x={134} y={150} rot={-30} s={0.9} />
      <Meringue x={80} y={184} s={0.9} />
      <Macaron x={112} y={166} />
      <Daisy x={130} y={192} s={0.9} />
      <Leaf x={140} y={198} rot={10} s={0.75} />

      {/* ── Garnish: right rim ── */}
      <Leaf x={258} y={152} rot={-160} s={0.85} />
      <Leaf x={292} y={152} rot={-35} s={0.95} />
      <Daisy x={276} y={162} s={1} />
      <Meringue x={316} y={182} s={0.95} />
      <VioletFlower x={272} y={192} s={0.9} />

      {/* ── Bow (front, over the plate) ── */}
      <g>
        {/* tails */}
        <path d="M194 342 C178 356 158 368 128 382 L148 384 L140 396 C166 382 190 364 206 348 Z" fill="url(#lc-tail)" />
        <path d="M206 342 C222 356 242 368 272 382 L252 384 L260 396 C234 382 210 364 194 348 Z" fill="url(#lc-tail)" />
        {/* loops */}
        <path d="M200 334 C178 300 126 290 120 318 C116 344 168 352 200 340 Z" fill="url(#lc-bow)" />
        <path d="M200 334 C222 300 274 290 280 318 C284 344 232 352 200 340 Z" fill="url(#lc-bow)" />
        {/* inner folds */}
        <path d="M196 333 C178 316 150 310 136 318 C150 316 172 322 194 338 Z" fill="#8c69b8" opacity=".55" />
        <path d="M204 333 C222 316 250 310 264 318 C250 316 228 322 206 338 Z" fill="#8c69b8" opacity=".55" />
        <path d="M134 302 C146 296 164 300 178 310" stroke="#ddc9f3" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
        <path d="M266 302 C254 296 236 300 222 310" stroke="#ddc9f3" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
        {/* knot */}
        <rect x="186" y="322" width="28" height="26" rx="9" fill="url(#lc-bow)" stroke="#9372c2" strokeWidth="1" />
        <path d="M192 328 C196 325 204 325 208 328" stroke="#e2d1f5" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
