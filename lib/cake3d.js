/**
 * Real-time 3D lavender cake (three.js), built entirely from code — no model
 * files. Cream sponge, lilac fondant drip, satin ribbon with a folded bow,
 * puffy fondant stars, sugar pearls, macaron / meringue / flower garnish,
 * piped writing on the board, and twisted wax candles with soft real flames.
 *
 * Realism comes from: soft (VSM) shadows, ambient occlusion in the creases
 * (GTAO post-process), a studio environment for soft reflections, irregular
 * drips with heavy tips, spatula streaks in the buttercream, and flames that
 * glow (soft edges, blue root, white-hot core) instead of solid shapes.
 *
 * Only ever imported dynamically from Cake3D.jsx, so three.js stays out of
 * the server render and the first page load.
 *
 *   const cake = createCake3D(container, { candles, readBlow, message });
 *   cake.setOut(true);   // blow them out
 *   cake.dispose();
 *
 * Drag sideways to spin the cake, up/down to look at it from above.
 * readBlow() → { blow 0..1, progress 0..1 } every frame: blow is breath
 * strength (1 = strong enough to count), progress how far a strong breath has
 * got. A soft breath makes the flames flicker; a strong one pushes them BACK,
 * away from the viewer (who blows from the front).
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ---------- dimensions (world units, 1 ≈ 4 cm) ---------- */
const R = 2.3; // sponge radius
const FONDANT = 0.06; // fondant thickness
const BASE = 0.32; // top of the cake board
const TOP = BASE + 2.6; // top of the fondant
const RB = R + 0.06; // ribbon band radius
const BOARD_R = 3.55; // flat top of the board (the rounded rim adds BASE / 2)
const CANDLE_H = 1.3;
const CANDLE_R = 0.068;
const STRIPE_PITCH = 0.27; // candle height per stripe repeat (half a turn of the twist)
const FLAME_H = 0.5;
const FX_LAYER = 1; // flames, glow, smoke, writing: rendered, but kept out of the AO pass

/* ---------- palette ---------- */
const COL = {
  cream: "#f6e8d3",
  lilac: "#b898dc",
  lilacDeep: "#9873c6",
  lilacPale: "#dccaf2",
  butter: "#f4c446",
  leaf: "#86b257",
  board: "#fbf8fa",
  petal: "#fffaf3",
  ink: "#7d57ad", // piped writing: the deep purple of the page
};

/* deterministic pseudo-random so the cake is identical on every load */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const physical = (color, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

/** Lathe from (radius, y) pairs listed bottom → top. */
const lathe = (pts, segments = 160) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);

function arc(cx, cy, r, a0, a1, steps = 6) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/* ---------- textures drawn on canvases ---------- */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(size, draw, { repeat, srgb = true } = {}) {
  const c = makeCanvas(size[0], size[1]);
  draw(c.getContext("2d"), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 4;
  return t;
}

/** Seamless soft noise — used as a bump map so icing has a hand-made surface. */
function noiseTexture(seed, blobs, repeat) {
  const rand = rng(seed);
  return canvasTexture(
    [256, 256],
    (g, w, h) => {
      g.fillStyle = "rgb(128,128,128)";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < blobs; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 2 + rand() * 9;
        const v = Math.round(128 + (rand() - 0.5) * 70);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
        grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = grad;
        // wrapped copies so the texture tiles without seams
        for (const dx of [-w, 0, w]) {
          for (const dy of [-h, 0, h]) {
            g.save();
            g.translate(x + dx, y + dy);
            g.fillRect(-r, -r, r * 2, r * 2);
            g.restore();
          }
        }
      }
    },
    { repeat, srgb: false }
  );
}

/** Buttercream smoothed with a spatula: long faint horizontal streaks + speckle. */
function streakTexture(seed, repeat) {
  const rand = rng(seed);
  return canvasTexture(
    [512, 256],
    (g, w, h) => {
      g.fillStyle = "rgb(128,128,128)";
      g.fillRect(0, 0, w, h);
      g.lineCap = "round";
      for (let i = 0; i < 240; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const len = 50 + rand() * 280;
        const bend = (rand() - 0.5) * 5;
        const end = (rand() - 0.5) * 3;
        const v = rand() < 0.5 ? 156 : 100;
        g.strokeStyle = `rgba(${v},${v},${v},${0.1 + rand() * 0.22})`;
        g.lineWidth = 1 + rand() * 3;
        for (const dx of [-w, 0, w]) {
          g.beginPath();
          g.moveTo(x + dx, y);
          g.quadraticCurveTo(x + dx + len / 2, y + bend, x + dx + len, y + end);
          g.stroke();
        }
      }
      for (let i = 0; i < 2600; i++) {
        const v = Math.round(128 + (rand() - 0.5) * 80);
        g.fillStyle = `rgba(${v},${v},${v},0.5)`;
        g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
      }
    },
    { repeat, srgb: false }
  );
}

/** Lilac stripes on cream wax along lines of constant (a·u + b·v), which tile
 *  seamlessly for whole a and b. */
const waxStripes = (a, b, repeat) =>
  canvasTexture(
    [128, 128],
    (g, w, h) => {
      const img = g.createImageData(w, h);
      const wax = [252, 246, 236];
      const lilac = [170, 134, 216];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ph = (a * (x / w) + b * (1 - y / h)) % 1;
          const k = smoothstep(0, 0.025, ph) * (1 - smoothstep(0.4, 0.425, ph));
          const o = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(wax[c] + (lilac[c] - wax[c]) * k);
          img.data[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
    { repeat }
  );

/** Twisted candles: two helices up the candle, in line with its grooves. */
const stripeTexture = () => waxStripes(2, 1, [1, CANDLE_H / STRIPE_PITCH]);

/** Number candles: diagonal stripes across the face (UVs are in digit units). */
const digitStripeTexture = () => waxStripes(2, 2, [2.4, 2.4]);

/** Emissive mask: the top few millimetres of wax glow warm while lit. */
const waxGlowTexture = () =>
  canvasTexture([4, 256], (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); // canvas top = candle top
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.05, "#9a9a9a");
    grad.addColorStop(0.12, "#1c1c1c");
    grad.addColorStop(0.22, "#000000");
    grad.addColorStop(1, "#000000");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

const radialTexture = (stops) =>
  canvasTexture([128, 128], (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => grad.addColorStop(o, c));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  });

/** Two-pass box blur on a float image. */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Piped writing for the board: a colour map (icing + its soft shadow) and a
 * normal map made from the blurred letters, so the strokes look raised and
 * rounded like real piping. Drawn into a long strip that is bent round the
 * front of the board, so the text follows the curve.
 */
function pipedText(text, color) {
  const W = 2048;
  const H = 256;
  const colorCanvas = makeCanvas(W, H);
  const normalCanvas = makeCanvas(W, H);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.anisotropy = 8;

  const font = (px) => `600 ${px}px Fredoka, Nunito, sans-serif`;
  // letters are drawn a little taller than normal: the board is seen at a low
  // angle, which squashes them, so this keeps them easy to read
  const STRETCH = 1.35;

  const paint = () => {
    const probe = makeCanvas(8, 8).getContext("2d");
    probe.font = font(100);
    const px = Math.min(190, (100 * W * 0.9) / Math.max(1, probe.measureText(text).width));
    const draw = (g) => {
      g.save();
      g.translate(W / 2, H / 2 + px * 0.06);
      g.scale(1, STRETCH);
      g.font = font(px);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = px * 0.075;
      g.fillText(text, 0, 0);
      g.strokeText(text, 0, 0);
      g.restore();
    };

    /* height field from the letters → normal map */
    const hc = makeCanvas(W, H);
    const hg = hc.getContext("2d");
    hg.fillStyle = hg.strokeStyle = "#fff";
    draw(hg);
    const alpha = hg.getImageData(0, 0, W, H).data;
    let hf = new Float32Array(W * H);
    for (let i = 0; i < hf.length; i++) hf[i] = alpha[i * 4 + 3] / 255;
    hf = boxBlur(boxBlur(hf, W, H, 3), W, H, 3);
    for (let i = 0; i < hf.length; i++) hf[i] = Math.sqrt(hf[i]); // rounded, like a piped bead

    const ng = normalCanvas.getContext("2d");
    const nimg = ng.createImageData(W, H);
    const K = 5;
    for (let y = 0; y < H; y++) {
      const up = Math.max(0, y - 1) * W;
      const dn = Math.min(H - 1, y + 1) * W;
      for (let x = 0; x < W; x++) {
        const l = hf[y * W + Math.max(0, x - 1)];
        const r = hf[y * W + Math.min(W - 1, x + 1)];
        const nx = (l - r) * K;
        const ny = (hf[dn + x] - hf[up + x]) * K; // canvas y runs down, texture v runs up
        const inv = 1 / Math.hypot(nx, ny, 1);
        const o = (y * W + x) * 4;
        nimg.data[o] = Math.round((nx * inv * 0.5 + 0.5) * 255);
        nimg.data[o + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
        nimg.data[o + 2] = Math.round((inv * 0.5 + 0.5) * 255);
        nimg.data[o + 3] = 255;
      }
    }
    ng.putImageData(nimg, 0, 0);

    /* colour: a soft shadow falling back-right (away from the key light), then the icing */
    const cg = colorCanvas.getContext("2d");
    cg.clearRect(0, 0, W, H);
    cg.save();
    cg.shadowColor = "rgba(70, 40, 100, 0.38)";
    cg.shadowBlur = 9;
    cg.shadowOffsetX = 5;
    cg.shadowOffsetY = -7;
    cg.fillStyle = cg.strokeStyle = color;
    draw(cg);
    cg.restore();

    map.needsUpdate = true;
    normalMap.needsUpdate = true;
  };

  return { map, normalMap, paint, font: font(190) };
}

/* ---------- geometry builders ---------- */

/** Grid of vertices → indexed BufferGeometry. vertexAt(s, t) → [x, y, z, u, v]. */
function gridGeometry(cols, rows, vertexAt) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const [x, y, z, u, v] = vertexAt(i / cols, j / rows);
      pos.push(x, y, z);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = (i + 1) * (rows + 1) + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Fondant drip skirt. The edge is a band with irregular drips hanging from
 * it: different widths and lengths, round bottoms, filleted where they leave
 * the band, and a heavier bead of fondant at each tip. The thickness falls off
 * by distance to that edge, so every edge is rounded the same way, and below
 * the edge the surface dives just under the sponge, so the edge you see is
 * exactly the curve.
 */
function dripGeometry() {
  const rand = rng(29);
  const RS = R + 0.004;
  const BAND = 0.17; // solid overhang along the top edge
  const LIP = 0.045; // how wide the rounded lip is
  const drips = [];
  for (let th = rand() * 0.2; th < Math.PI * 2 - 0.22; ) {
    const w = 0.048 + rand() * 0.06; // half width, radians
    const len = 0.2 + Math.pow(rand(), 1.25) * 0.62;
    drips.push({ c: th + w, hw: w * RS, len });
    th += 2 * w + 0.05 + rand() * 0.2;
  }
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const smax = (a, b, k) => {
    const h = clamp01(0.5 + (0.5 * (a - b)) / k);
    return b + (a - b) * h + k * h * (1 - h);
  };
  const edge = (th) => {
    let d = BAND + 0.022 * Math.sin(th * 7 + 1) + 0.012 * Math.sin(th * 13 + 2);
    for (const k of drips) {
      const dx = Math.abs(angDiff(th, k.c) * RS);
      if (dx > k.hw + 0.25) continue;
      const v =
        dx < k.hw
          ? BAND + k.len - k.hw + Math.sqrt(k.hw * k.hw - dx * dx)
          : BAND + k.len - k.hw - (dx - k.hw) * 14; // steep sides beyond the drip, for the fillet
      d = smax(d, v, 0.05);
    }
    return d;
  };

  const COLS = 960;
  const ROWS = 76;
  const E = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) E[i] = edge((i / COLS) * Math.PI * 2);
  const step = ((Math.PI * 2) / COLS) * RS;
  const slope = (i) => (E[(i + 1) % COLS] - E[(i - 1 + COLS) % COLS]) / (2 * step);
  const maxDepth = Math.max(...E) + 0.05;
  const top = TOP - 0.12;

  return gridGeometry(COLS, ROWS, (s, t) => {
    const i = Math.round(s * COLS);
    const th = s * Math.PI * 2;
    const d = t * maxDepth;
    const e = E[i];
    const dist = (e - d) / Math.sqrt(1 + slope(i % COLS) ** 2); // > 0 inside the fondant
    let off;
    if (dist <= 0) off = Math.max(-0.02, dist * 0.8);
    else {
      const q = Math.min(1, dist / LIP);
      off = FONDANT * Math.sqrt(1 - (1 - q) * (1 - q));
      const tip = clamp01((e - BAND - 0.12) / 0.25); // only real drips get the heavy bead
      off *= 1 + 0.9 * tip * Math.exp(-(((e - d - 0.075) / 0.06) ** 2));
    }
    const r = RS + off;
    return [Math.sin(th) * r, top - d, Math.cos(th) * r, s * 10, t];
  });
}

/**
 * Twisted birthday candle: fine spiral grooves (in line with the stripes), a
 * rounded rim and a slightly sunken top where the wax melts round the wick.
 * Centred on its middle, like a CylinderGeometry.
 */
function candleGeometry() {
  const FLUTES = 8;
  const BODY = 0.86; // share of the rows used by the side
  const EDGE = 0.016;
  const tiles = CANDLE_H / STRIPE_PITCH;
  return gridGeometry(72, 110, (s, t) => {
    const th = -s * Math.PI * 2; // this direction makes the faces point outwards
    let y;
    let r;
    let groove = 1;
    if (t <= BODY) {
      y = (t / BODY) * (CANDLE_H - EDGE);
      r = CANDLE_R;
    } else {
      const q = (t - BODY) / (1 - BODY);
      if (q < 0.5) {
        const a = (q / 0.5) * (Math.PI / 2);
        y = CANDLE_H - EDGE + Math.sin(a) * EDGE;
        r = CANDLE_R - EDGE + Math.cos(a) * EDGE;
        groove = 1 - q;
      } else {
        const w = (q - 0.5) / 0.5;
        r = (CANDLE_R - EDGE) * (1 - w);
        y = CANDLE_H - 0.007 * Math.sin((w * Math.PI) / 2);
        groove = 0.5 * (1 - w);
      }
    }
    const vt = (y / CANDLE_H) * tiles;
    r *= 1 + 0.045 * groove * Math.cos(2 * Math.PI * (FLUTES * s + (FLUTES / 2) * vt));
    return [Math.sin(th) * r, y - CANDLE_H / 2, Math.cos(th) * r, s, y / CANDLE_H];
  });
}

/** Charred wick, curling over at the tip. Starts just inside the wax. */
const wickGeometry = () =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0.004, 0.08, 0.001),
      new THREE.Vector3(0.016, 0.108, 0.004),
    ]),
    12,
    0.0085,
    6
  );

/**
 * One loop of a fondant bow: a ribbon folded back on itself. The curve runs
 * out along the front, turns at the far end and returns along the back; the
 * ribbon is pinched at the knot and flares wide at the outer end.
 */
function bowLoopGeometry({ L = 0.62, D = 0.25, w0 = 0.12, w1 = 0.44, puff = 0.07 } = {}) {
  return gridGeometry(120, 12, (s, t) => {
    const ph = s * Math.PI * 2;
    const half = Math.abs(Math.sin(ph / 2));
    const cx = (L * (1 - Math.cos(ph))) / 2;
    const cz = D * Math.sin(ph) * half;
    const w = w0 + (w1 - w0) * half * half;
    let nx = cx - L * 0.55;
    let nz = cz;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const v = t * 2 - 1;
    const bulge = puff * (1 - v * v) * half;
    const droop = -0.06 * half * half;
    return [cx + nx * bulge, v * (w / 2) + droop, cz + nz * bulge, s, t];
  });
}

/** Hanging bow tail: a flat ribbon along a curve, with a V-notched end. */
function bowTailGeometry(points, width = 0.2, notch = 0.14) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const a = points[0];
  const b = points[points.length - 1];
  const h = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize();
  const side = new THREE.Vector3(h.z, 0, -h.x); // horizontal, across the ribbon
  const p = new THREE.Vector3();
  return gridGeometry(48, 6, (s, t) => {
    const v = t * 2 - 1;
    curve.getPoint(s * (1 - notch * (1 - Math.abs(v))), p);
    const w = width * (1 + 0.25 * s);
    return [p.x + side.x * v * (w / 2), p.y, p.z + side.z * v * (w / 2), s, t];
  });
}

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Puffy fondant star: thin extrusion with a fat, rounded bevel. */
function starGeometry() {
  const g = new THREE.ExtrudeGeometry(starShape(0.15, 0.075), {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.05,
    bevelSegments: 6,
    curveSegments: 4,
  });
  g.center();
  return g;
}

/** Piped meringue kiss with a twisted ridge. */
function meringueGeometry() {
  const pts = [
    [0.001, 0], [0.26, 0], [0.29, 0.05], [0.27, 0.12], [0.2, 0.22],
    [0.12, 0.32], [0.06, 0.4], [0.02, 0.47], [0.001, 0.5],
  ];
  const g = lathe(pts, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.13 * Math.sin(8 * a + y * 14) * Math.min(1, y * 6);
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Leaf: a sphere tapered to points at both ends and gently curled. */
function leafGeometry() {
  const g = new THREE.SphereGeometry(1, 24, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const taper = Math.sqrt(Math.max(0, 1 - x * x));
    p.setXYZ(i, x * 0.26, p.getY(i) * 0.03 + 0.05 * x * x, p.getZ(i) * 0.1 * taper);
  }
  g.computeVertexNormals();
  return g;
}

/** Candle flame: round base, widest low down, long tapering tip. */
const flameGeometry = () =>
  lathe(
    [
      [0.001, 0], [0.027, 0.008], [0.049, 0.033], [0.065, 0.074], [0.071, 0.12],
      [0.069, 0.167], [0.06, 0.226], [0.046, 0.298], [0.03, 0.369], [0.015, 0.435],
      [0.005, 0.48], [0.001, FLAME_H],
    ],
    32
  );

/**
 * A flame is light, not a solid: edges fade out (facing ratio) and the tip
 * wanders a little. Two nested shells: the envelope is blended normally so it
 * keeps its yellow-orange colour on a light page (faint blue root, orange
 * tip), and the core is added on top in HDR so it burns white-hot.
 */
const FLAME_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 p = position;
    vH = clamp(p.y / ${FLAME_H.toFixed(3)}, 0.0, 1.0);
    float w = vH * vH;
    p.x += w * (sin(uTime * 9.0 + uSeed) * 0.010 + sin(uTime * 21.0 + uSeed * 1.7) * 0.005);
    p.z += w * sin(uTime * 7.3 + uSeed * 2.3) * 0.007;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FLAME_FRAG = /* glsl */ `
  uniform float uAlive;
  uniform float uHot;
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float soft = smoothstep(0.0, 0.85, facing);
    vec3 col;
    float a = soft;
    if (uHot < 0.5) {
      col = mix(vec3(0.3, 0.45, 1.0), vec3(1.0, 0.8, 0.3), smoothstep(0.04, 0.24, vH));
      col = mix(col, vec3(1.0, 0.42, 0.07), smoothstep(0.5, 1.0, vH));
      a *= mix(0.22, 0.95, smoothstep(0.03, 0.22, vH));
      a *= 1.0 - smoothstep(0.7, 1.0, vH) * 0.8;
    } else {
      col = mix(vec3(2.9, 2.6, 2.0), vec3(1.8, 1.1, 0.3), smoothstep(0.35, 1.0, vH));
      a *= 0.85 * (1.0 - smoothstep(0.6, 1.0, vH) * 0.7);
    }
    a *= uAlive;
    gl_FragColor = vec4(col * a, a);
  }
`;
const flameMaterial = (hot, seed) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uAlive: { value: 1 }, uHot: { value: hot } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    transparent: true,
    premultipliedAlpha: true, // the shader already weights colour by alpha
    blending: hot ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });

/* ---------- number candles ---------- */

/** Polygon with rounded corners: points are [x, y, cornerRadius]. */
function roundedShape(points) {
  const s = new THREE.Shape();
  const n = points.length;
  const toward = (a, b, len) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const k = Math.min(len, Math.hypot(dx, dy) / 2) / Math.hypot(dx, dy);
    return [a[0] + dx * k, a[1] + dy * k];
  };
  points.forEach((p, i) => {
    const t1 = toward(p, points[(i - 1 + n) % n], p[2]);
    const t2 = toward(p, points[(i + 1) % n], p[2]);
    if (i === 0) s.moveTo(...t1);
    else s.lineTo(...t1);
    s.quadraticCurveTo(p[0], p[1], ...t2);
  });
  s.closePath();
  return s;
}

/**
 * Chunky, rounded digits (like the page's rounded font), 1 unit tall, with
 * the x where the wick goes. Strokes are 0.23 wide.
 */
const DIGITS = {
  1: {
    wickX: 0.33,
    shape: () =>
      roundedShape([
        [0.185, 0, 0.09], [0.415, 0, 0.09], [0.415, 1, 0.1], [0.27, 1, 0.08],
        [0.02, 0.8, 0.08], [0.05, 0.575, 0.08], [0.185, 0.683, 0.04],
      ]),
  },
  2: {
    wickX: 0.34,
    shape: () => {
      const W = 0.23;
      const [cx, cy] = [0.34, 0.66]; // centre of the curve at the top
      const RO = 0.34;
      const RI = RO - W;
      const RM = (RO + RI) / 2;
      const END = (165 * Math.PI) / 180; // where the hook ends, on the left
      const s = new THREE.Shape();
      s.moveTo(0.1, 0);
      s.lineTo(0.62, 0);
      s.absarc(0.62, W / 2, W / 2, -Math.PI / 2, Math.PI / 2, false); // round end of the base
      s.lineTo(0.389, W);
      s.lineTo(0.51, 0.366); // up the diagonal to the curve
      s.absarc(cx, cy, RO, (-60 * Math.PI) / 180, END, false); // over the top
      s.absarc(cx + Math.cos(END) * RM, cy + Math.sin(END) * RM, W / 2, END, END + Math.PI, false); // round tip
      s.absarc(cx, cy, RI, END, (-10 * Math.PI) / 180, true); // inside of the curve
      s.lineTo(0, 0.14); // back down the diagonal
      s.quadraticCurveTo(0, 0, 0.1, 0);
      return s;
    },
  },
};

const DIGIT_H = 1.55; // about 7 cm, like a real number candle

/** Extruded wax digit with rounded edges, standing on y = 0, centred in x and z. */
function digitGeometry(d) {
  const g = new THREE.ExtrudeGeometry(DIGITS[d].shape(), {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.032,
    bevelSegments: 6,
    curveSegments: 24,
  });
  g.scale(DIGIT_H, DIGIT_H, DIGIT_H);
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const cx = (min.x + max.x) / 2;
  g.translate(-cx, -min.y, -(min.z + max.z) / 2);
  // smooth shading over the rounded edges, but keep real corners crisp
  const geo = toCreasedNormals(g, (50 * Math.PI) / 180);
  if (geo !== g) g.dispose();
  return { geo, width: max.x - min.x, height: max.y - min.y, wickX: DIGITS[d].wickX * DIGIT_H - cx };
}

/* ---------- candle layout: a loose ring round the middle of the top ---------- */
function candleSpots(count) {
  if (count <= 1) return [[0, 0]];
  if (count === 2) return [[-0.32, 0.05], [0.32, -0.05]];
  const r = count <= 3 ? 0.42 : 0.6 + (count - 5) * 0.07;
  return Array.from({ length: count }, (_, i) => {
    const a = Math.PI + (i / count) * Math.PI * 2; // first one at the back
    return [Math.sin(a) * r, Math.cos(a) * r];
  });
}

/* ================================================================== */

export function createCake3D(
  container,
  { candles = 3, number = "", readBlow = () => ({ blow: 0, progress: 0 }), message = "" } = {}
) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // ?quality=high keeps the AO pass on even on slow devices, ?quality=low turns it off
  const quality = new URLSearchParams(window.location.search).get("quality");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let disposed = false;

  /* ---- renderer ---- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "cake3d__canvas";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.layers.enable(FX_LAYER);
  // the AO pass looks through its own copy that never sees flames, smoke or writing
  const aoCamera = camera.clone();

  /* ---- lights: one strong soft key from the front-left, little fill, so the
          cake has real light and shade; cool rim from behind; + the candles ---- */
  scene.add(new THREE.HemisphereLight("#fff7fb", "#b9a3cc", 0.38));

  const key = new THREE.DirectionalLight("#fff3e6", 3.3);
  key.position.set(-5, 9, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 1, far: 28 });
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0006;
  scene.add(key);

  const rim = new THREE.DirectionalLight("#dccbff", 1.25);
  rim.position.set(5, 5, -6);
  scene.add(rim);

  const fill = new THREE.DirectionalLight("#ffffff", 0.16);
  fill.position.set(6, 2, 7);
  scene.add(fill);

  const candleLight = new THREE.PointLight("#ffb862", 0, 0, 2);
  candleLight.position.set(0, TOP + CANDLE_H + 0.6, 0.1);
  scene.add(candleLight);

  /* ---- table: soft contact shadow under the board ---- */
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * BOARD_R + 1.2, 2 * BOARD_R + 1.2),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(80,55,100,0.5)"], [0.5, "rgba(80,55,100,0.2)"], [1, "rgba(80,55,100,0)"]]),
      transparent: true,
      depthWrite: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.004;
  scene.add(contact);

  // (no cast shadow on the "table": on a flat web page it reads as a smudge;
  //  the cake still shadows its own board, which is what sells the depth)

  /* everything that turns */
  const cake = new THREE.Group();
  scene.add(cake);

  const add = (mesh, { cast = true, receive = true, parent = cake } = {}) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  };
  const fx = (obj) => {
    obj.layers.set(FX_LAYER);
    return obj;
  };

  /* ---- cake board ---- */
  add(
    new THREE.Mesh(
      lathe([[0.001, 0], [BOARD_R, 0], ...arc(BOARD_R, BASE / 2, BASE / 2, -Math.PI / 2, Math.PI / 2, 10), [0.001, BASE]], 200),
      physical(COL.board, { roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3 })
    )
  );

  /* ---- piped "Happy Birthday <name>" round the front of the board ---- */
  if (message) {
    const piping = pipedText(message, COL.ink);
    const IN = R + 0.6; // just in front of the bow tails
    const OUT = BOARD_R - 0.08;
    const SPAN = (((OUT - IN) * 2048) / 256 / ((IN + OUT) / 2)) * 1.0; // keeps the letters' proportions
    const strip = gridGeometry(160, 8, (s, t) => {
      const th = (s - 0.5) * SPAN;
      const r = IN + t * (OUT - IN);
      return [Math.sin(th) * r, BASE + 0.0015, Math.cos(th) * r, s, 1 - t];
    });
    const writing = fx(
      new THREE.Mesh(
        strip,
        physical("#ffffff", {
          map: piping.map,
          normalMap: piping.normalMap,
          roughness: 0.42,
          sheen: 0.5,
          sheenColor: new THREE.Color(COL.lilacPale),
          clearcoat: 0.15,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      )
    );
    writing.receiveShadow = true;
    cake.add(writing);
    // draw with the rounded font once it's ready (it already is if the cover used
    // it); if it's slow or blocked, draw with the fallback and redraw when it lands
    const fonts = document.fonts;
    const paint = () => !disposed && piping.paint();
    if (!fonts?.load || fonts.check?.(piping.font, message)) paint();
    else {
      let painted = false;
      const timer = setTimeout(() => {
        painted = true;
        paint();
      }, 1200);
      fonts
        .load(piping.font, message)
        .then((loaded) => {
          clearTimeout(timer);
          if (loaded.length || !painted) paint();
        })
        .catch(() => {
          clearTimeout(timer);
          paint();
        });
    }
  }

  /* ---- sponge body (cream, smoothed with a spatula) ---- */
  const creamMat = physical(COL.cream, {
    roughness: 0.8,
    sheen: 0.35,
    sheenColor: new THREE.Color("#fff"),
    sheenRoughness: 0.7,
    bumpMap: streakTexture(3, [5, 3]),
    bumpScale: 1.1,
  });
  add(new THREE.Mesh(lathe([[R - 0.02, BASE], [R, BASE + 0.03], [R, TOP - 0.1], [R - 0.05, TOP - 0.05]]), creamMat));

  /* ---- fondant: top cap with a soft rounded edge + drip skirt ---- */
  const fondantMat = physical(COL.lilac, {
    roughness: 0.48,
    sheen: 0.45,
    sheenColor: new THREE.Color(COL.lilacPale),
    sheenRoughness: 0.55,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22, // a soft shine, like a glossy drip
    bumpMap: noiseTexture(5, 900, [6, 2]),
    bumpScale: 0.5,
  });
  const RF = R + FONDANT;
  add(new THREE.Mesh(lathe([[RF, TOP - 0.16], ...arc(RF - 0.12, TOP - 0.12, 0.12, 0, Math.PI / 2, 10), [0.001, TOP]]), fondantMat));
  add(new THREE.Mesh(dripGeometry(), fondantMat));

  /* ---- satin ribbon band ---- */
  const ribbonMat = physical(COL.lilacDeep, {
    roughness: 0.36,
    sheen: 1,
    sheenColor: new THREE.Color(COL.lilacPale),
    sheenRoughness: 0.32,
    clearcoat: 0.2,
    side: THREE.DoubleSide,
  });
  add(
    new THREE.Mesh(
      lathe([[R, BASE], ...arc(RB - 0.04, BASE + 0.05, 0.04, -Math.PI / 2, 0, 4), ...arc(RB - 0.04, BASE + 0.42, 0.04, 0, Math.PI / 2, 4), [R, BASE + 0.46]]),
      ribbonMat
    )
  );

  /* ---- folded ribbon bow at the front ---- */
  const bow = new THREE.Group();
  bow.position.set(0, BASE + 0.25, RB);
  bow.scale.setScalar(1.45);
  cake.add(bow);
  const loopGeo = bowLoopGeometry();
  const BOARD_Y = -0.25 / 1.45 + 0.006; // board surface, in the bow's scaled space
  const tailGeo = bowTailGeometry(
    [
      [0.02, -0.03, 0.12],
      [0.07, -0.11, 0.15],
      [0.12, BOARD_Y + 0.01, 0.2],
      [0.18, BOARD_Y, 0.27],
      [0.24, BOARD_Y, 0.33],
    ],
    0.15,
    0.16
  );
  [1, -1].forEach((side) => {
    const loop = add(new THREE.Mesh(loopGeo, ribbonMat), { parent: bow });
    loop.scale.x = side;
    loop.position.set(0, 0.03, 0.17);
    loop.rotation.set(0, side * 0.14, side * 0.22);
    const tail = add(new THREE.Mesh(tailGeo, ribbonMat), { parent: bow });
    tail.scale.x = side;
  });
  const knot = add(new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.27, 0.2, 4, 0.08), ribbonMat), { parent: bow });
  knot.position.set(0, 0.02, 0.2);

  /* ---- stars + pearls on the sponge ---- */
  const starGeo = starGeometry();
  const starMat = physical(COL.butter, { roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color("#fff1b8"), clearcoat: 0.15 });
  const onSide = (obj, th, y, out = 0) => {
    obj.position.set(Math.sin(th) * (R + out), y, Math.cos(th) * (R + out));
    obj.rotation.y = th;
    return obj;
  };
  const STAR_SIZES = [1, 0.9, 1, 0.85, 0.85, 0.9, 0.9, 0.85, 0.65, 0.6];
  const STARS = [
    [-0.72, 1.4], [0.02, 1.62], [0.74, 1.3], [1.45, 1.66], [-1.45, 1.72],
    [2.2, 1.36], [-2.25, 1.42], [3.05, 1.56], [-0.38, 1.0], [0.42, 0.98],
  ].map(([th, y], i) => [th, y + BASE - 0.24, STAR_SIZES[i]]);
  const rand = rng(11);
  STARS.forEach(([th, y, s]) => {
    const m = onSide(add(new THREE.Mesh(starGeo, starMat)), th, y, 0.035);
    m.scale.setScalar(s);
    m.rotateZ((rand() - 0.5) * 0.8);
  });

  const pearlSpots = [];
  for (let i = 0; i < 60 && pearlSpots.length < 44; i++) {
    const th = rand() * Math.PI * 2;
    const y = BASE + 0.62 + rand() * 0.95;
    const near = STARS.some(([sth, sy]) => Math.abs(Math.atan2(Math.sin(th - sth), Math.cos(th - sth))) < 0.2 && Math.abs(y - sy) < 0.25);
    if (!near) pearlSpots.push([th, y]);
  }
  const pearls = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    physical("#fff6e6", { roughness: 0.3, clearcoat: 0.8, sheen: 0.5, sheenColor: new THREE.Color("#fff") }),
    pearlSpots.length
  );
  const dummy = new THREE.Object3D();
  pearlSpots.forEach(([th, y], i) => {
    onSide(dummy, th, y, 0.02);
    dummy.updateMatrix();
    pearls.setMatrixAt(i, dummy.matrix);
  });
  add(pearls, { cast: false });

  /* ---- top garnish around the rim (candles stay in the middle) ---- */
  const onTop = (obj, th, r, y = TOP) => {
    obj.position.set(Math.sin(th) * r, y, Math.cos(th) * r);
    cake.add(obj);
    obj.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    return obj;
  };

  const meringueGeo = meringueGeometry();
  const meringueMat = physical("#fffaf1", { roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color("#fff") });
  [[-1.62, 1.95, 1], [1.72, 1.98, 1.05], [3.0, 1.85, 0.85], [-2.75, 1.9, 0.8]].forEach(([th, r, s]) => {
    const m = new THREE.Mesh(meringueGeo, meringueMat);
    m.scale.setScalar(s);
    m.rotation.y = th * 3;
    onTop(m, th, r, TOP - 0.01);
  });

  const leafGeo = leafGeometry();
  const leafMat = physical(COL.leaf, { roughness: 0.5, clearcoat: 0.25, side: THREE.DoubleSide });
  const leaf = (th, r, yaw, tilt = 0.15) => {
    const m = new THREE.Mesh(leafGeo, leafMat);
    m.rotation.set(0, yaw, tilt);
    return onTop(m, th, r, TOP + 0.03);
  };

  const petalGeo = new THREE.SphereGeometry(0.1, 16, 10);
  const centreGeo = new THREE.SphereGeometry(0.075, 16, 12);
  const flower = (th, r, petalColor, centreColor, s = 1) => {
    const g = new THREE.Group();
    const pMat = physical(petalColor, { roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#fff") });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(petalGeo, pMat);
      const a = (i / n) * Math.PI * 2;
      p.scale.set(0.95, 0.32, 1.7);
      p.position.set(Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15);
      p.rotation.set(-0.22, a, 0, "YXZ"); // petals cup upwards
      g.add(p);
    }
    const c = new THREE.Mesh(centreGeo, physical(centreColor, { roughness: 0.55, clearcoat: 0.3 }));
    c.scale.y = 0.7;
    c.position.y = 0.07;
    g.add(c);
    g.scale.setScalar(s);
    g.rotation.set(-0.1, th, 0);
    return onTop(g, th, r, TOP + 0.02);
  };

  /* macaron, back-left: shells, filling, ruffled feet */
  const mac = new THREE.Group();
  const macMat = physical("#ad88d8", {
    roughness: 0.62,
    sheen: 0.7,
    sheenColor: new THREE.Color(COL.lilacPale),
    bumpMap: noiseTexture(9, 500, [3, 3]),
    bumpScale: 0.8,
  });
  const shell = new THREE.SphereGeometry(0.36, 40, 24);
  const bottomShell = new THREE.Mesh(shell, macMat);
  bottomShell.scale.set(1, 0.4, 1);
  bottomShell.position.y = 0.13;
  const topShell = bottomShell.clone();
  topShell.position.y = 0.4;
  const filling = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 40), physical("#fbf0dc", { roughness: 0.85 }));
  filling.position.y = 0.265;
  const footGeo = new THREE.TorusGeometry(0.345, 0.035, 8, 96);
  {
    const p = footGeo.attributes.position;
    const fr = rng(4);
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (fr() - 0.5) * 0.06;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * (1 + (fr() - 0.5) * 0.5));
    }
    footGeo.computeVertexNormals();
  }
  const footMat = physical("#a07ccf", { roughness: 0.85 });
  const foot1 = new THREE.Mesh(footGeo, footMat);
  foot1.rotation.x = Math.PI / 2;
  foot1.position.y = 0.33;
  const foot2 = foot1.clone();
  foot2.position.y = 0.2;
  mac.add(bottomShell, topShell, filling, foot1, foot2);
  mac.rotation.set(0.12, 0, 0.32);
  onTop(mac, -2.35, 1.72, TOP - 0.04);

  flower(-1.95, 1.55, COL.petal, COL.butter, 1.45);
  flower(2.15, 1.75, COL.petal, COL.butter, 1.5);
  flower(1.25, 1.85, "#a780d4", COL.butter, 1.3);
  flower(-2.95, 1.6, COL.petal, COL.butter, 1.2);
  leaf(-2.0, 1.95, 0.6);
  leaf(-2.7, 1.45, -0.9);
  leaf(2.45, 1.95, -0.5);
  leaf(1.95, 1.5, 1.1);
  leaf(1.05, 1.6, 0.2);

  /* ---- candles: number candles ("21") in lilac-striped wax — or, for digits we
          have no shape for, twisted candles — each with a charred wick and a soft flame ---- */
  const wax = { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28, sheen: 0.3, sheenColor: new THREE.Color("#fff") };
  const candleMat = physical("#ffffff", {
    map: stripeTexture(),
    ...wax,
    emissive: new THREE.Color("#ffab5c"),
    emissiveMap: waxGlowTexture(),
    emissiveIntensity: 0,
  });
  const wickGeo = wickGeometry();
  const wickMat = physical("#2b1f1c", { roughness: 0.95 });
  const emberGeo = new THREE.SphereGeometry(0.011, 10, 8);
  const flameGeo = flameGeometry();
  const glowTex = radialTexture([[0, "rgba(255,226,160,0.9)"], [0.3, "rgba(255,190,100,0.32)"], [1, "rgba(255,160,70,0)"]]);
  const smokeTex = radialTexture([[0, "rgba(170,150,175,0.55)"], [1, "rgba(170,150,175,0)"]]);
  /* every candle: a group standing on the cake, and where its wick goes in it.
     Each stands very slightly off-vertical, like a real one. */
  const holders = [];
  const digits = [...String(number || "")];
  if (digits.length && digits.every((d) => DIGITS[d])) {
    const digitMat = physical("#ffffff", { map: digitStripeTexture(), ...wax });
    const parts = digits.map(digitGeometry);
    const GAP = 0.12;
    let x = -(parts.reduce((sum, p) => sum + p.width, 0) + GAP * (parts.length - 1)) / 2;
    parts.forEach((p, i) => {
      const g = new THREE.Group();
      g.position.set(x + p.width / 2, TOP - 0.04, 0.05);
      // turned a touch towards each other, like candles pushed in by hand
      g.rotation.set((rand() - 0.5) * 0.04, (i - (parts.length - 1) / 2) * -0.2, (rand() - 0.5) * 0.04);
      add(new THREE.Mesh(p.geo, digitMat), { parent: g });
      holders.push({ g, wick: new THREE.Vector3(p.wickX, p.height - 0.012, 0) });
      x += p.width + GAP;
    });
  } else {
    const candleGeo = candleGeometry();
    candleSpots(Math.max(1, candles)).forEach(([x, z]) => {
      const g = new THREE.Group();
      g.position.set(x, TOP - 0.03, z);
      g.rotation.set((rand() - 0.5) * 0.07, rand() * Math.PI * 2, (rand() - 0.5) * 0.07);
      const body = add(new THREE.Mesh(candleGeo, candleMat), { parent: g });
      body.position.y = CANDLE_H / 2;
      holders.push({ g, wick: new THREE.Vector3(0, CANDLE_H - 0.007, 0) });
    });
  }

  const flames = holders.map(({ g, wick: w }, i) => {
    cake.add(g);
    const wick = add(new THREE.Mesh(wickGeo, wickMat), { parent: g, cast: false });
    wick.position.copy(w);
    const emberMat = new THREE.MeshStandardMaterial({ color: "#1d1412", emissive: "#ff6a1f", emissiveIntensity: 0, roughness: 0.9 });
    const ember = add(new THREE.Mesh(emberGeo, emberMat), { parent: g, cast: false });
    ember.position.set(w.x + 0.016, w.y + 0.108, w.z + 0.004);

    /* where the flame sits (cake space): just above the wax, round the wick */
    g.updateMatrix();
    const tip = new THREE.Vector3(w.x, w.y + 0.027, w.z).applyMatrix4(g.matrix);

    /* flame pivots at its base so it can bend backwards; flames stay upright even on a tilted candle */
    const pivot = new THREE.Group();
    pivot.rotation.order = "YXZ";
    pivot.position.copy(tip);
    cake.add(pivot);
    const seed = rand() * 100;
    const outerMat = flameMaterial(0, seed);
    const coreMat = flameMaterial(1, seed);
    const outer = fx(new THREE.Mesh(flameGeo, outerMat));
    const core = fx(new THREE.Mesh(flameGeo, coreMat));
    core.scale.set(0.55, 0.66, 0.55);
    core.position.y = 0.035;
    outer.renderOrder = 2;
    core.renderOrder = 3;
    const flame = new THREE.Group();
    flame.add(outer, core);
    pivot.add(flame);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glow = fx(new THREE.Sprite(glowMat));
    glow.position.y = 0.17;
    glow.renderOrder = 1;
    pivot.add(glow);

    const puffs = Array.from({ length: 5 }, (_, k) => {
      const m = new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0 });
      const s = fx(new THREE.Sprite(m));
      s.position.copy(tip);
      cake.add(s);
      return { s, m, k, wob: rand() * Math.PI * 2 };
    });

    return { pivot, flame, mats: [outerMat, coreMat], glow, glowMat, emberMat, puffs, seed, delay: i * 0.08, tip };
  });

  /* ---- post-processing: ambient occlusion in the creases ---- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, aoCamera, 512, 512);
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
  gtao.updatePdMaterial({ radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.9;
  gtao.enabled = quality !== "low";
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  /* ---- orbit: drag sideways spins the cake, drag up/down tilts the view ---- */
  const PITCH_MIN = 0.06;
  const PITCH_MAX = 1.32;
  const PITCH_REST = 0.47;
  const view = { yaw: 0, pitch: PITCH_REST, vYaw: 0, vPitch: 0 };
  let touched = false;
  let dragging = false;
  let last = null;
  canvas.style.touchAction = "none";
  const onDown = (e) => {
    dragging = true;
    if (!touched) {
      touched = true;
      view.yaw = cake.rotation.y; // continue from the idle sway, no jump
    }
    last = { x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer: dragging still works without capture */
    }
  };
  const onMove = (e) => {
    if (!dragging || !last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    view.vYaw = dx * 0.011;
    view.vPitch = dy * 0.007;
    view.yaw += view.vYaw;
    view.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, view.pitch + view.vPitch));
  };
  const onUp = () => {
    dragging = false;
    last = null;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  const target = new THREE.Vector3();
  const placeCamera = () => {
    const k = Math.min(1, Math.max(0, (view.pitch - PITCH_REST) / (PITCH_MAX - PITCH_REST)));
    const dist = 15.6 + 1.4 * k;
    target.set(0, 1.62 + (TOP * 0.5 - 1.62) * k, 0);
    camera.position.set(0, target.y + Math.sin(view.pitch) * dist, Math.cos(view.pitch) * dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    aoCamera.copy(camera);
    aoCamera.layers.set(0);
  };

  /* ---- sizing ---- */
  const resize = () => {
    const w = container.clientWidth || 300;
    const h = container.clientHeight || w;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* only render while on screen */
  let onScreen = true;
  const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
  io.observe(container);

  /* ---- animation loop ---- */
  let outAt = null;
  let raf = 0;
  const clock = new THREE.Clock();
  const smooth = { blow: 0 };
  const up = new THREE.Vector3(0, 1, 0);
  const local = new THREE.Vector3();
  let slowFrames = 0;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!onScreen) return;
    const t = clock.elapsedTime;
    const { blow = 0, progress = 0 } = readBlow() || {};
    smooth.blow += (blow - smooth.blow) * Math.min(1, dt * 14);
    const b = smooth.blow;

    /* view: idle sway until the first touch, then free orbit with inertia */
    if (!dragging) {
      view.yaw += view.vYaw;
      view.vYaw *= 0.93;
      view.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, view.pitch + view.vPitch));
      view.vPitch *= 0.85;
    }
    cake.rotation.y = touched || reduceMotion ? view.yaw : Math.sin(t * 0.35) * 0.2;
    placeCamera();

    let lit = 0;
    flames.forEach((f) => {
      const n1 = Math.sin(t * 13 + f.seed) * 0.5 + Math.sin(t * 23.7 + f.seed * 2) * 0.3 + Math.sin(t * 5.1 + f.seed) * 0.2;
      let alive = 1;
      if (outAt != null) alive = Math.max(0, 1 - Math.max(0, (t - outAt - f.delay) / 0.35));
      lit += alive;

      /* breath from the front. A soft breath makes the flame flicker and sputter
         (fast, uneven wobble, size jumping) but it stays lit; a strong one
         (progress building) bends it right back, away from the viewer, and
         shrinks it until it goes out */
      const flutter =
        Math.sin(t * 31 + f.seed) * 0.5 + Math.sin(t * 47.3 + f.seed * 1.3) * 0.3 + Math.sin(t * 71 + f.seed * 2.1) * 0.2;
      const shake = b > 0.03 ? flutter * b : 0;
      f.pivot.rotation.y = -cake.rotation.y; // so "back" stays away from the viewer
      f.pivot.rotation.x = -(b * 0.5 + progress * 0.65 + Math.abs(shake) * 0.3);
      f.pivot.rotation.z = shake * 0.32 + (reduceMotion ? 0 : n1 * 0.03);

      const sy = (1 + n1 * 0.05 + shake * 0.2) * (1 - b * 0.15 - progress * 0.3) * alive;
      const sx = (1 - n1 * 0.03 - shake * 0.06) * (1 + b * 0.1) * alive;
      f.flame.scale.set(sx, Math.max(0.001, sy), sx);
      f.mats.forEach((m) => {
        m.uniforms.uTime.value = reduceMotion ? 0 : t;
        m.uniforms.uAlive.value = (1 - progress * 0.4) * alive;
      });
      f.glowMat.opacity = (0.14 + n1 * 0.02) * (1 - progress * 0.5) * alive;
      f.glow.scale.setScalar(0.3 * (1 + n1 * 0.05) * Math.max(0.001, alive));
      f.pivot.visible = alive > 0.001;

      /* after the flame dies: ember on the wick tip, then smoke drifting up & back */
      if (outAt != null) {
        const s = t - outAt - f.delay;
        f.emberMat.emissiveIntensity = s < 0 ? 0 : Math.max(0, 3 * (1 - s / 2.4));
        f.puffs.forEach((p) => {
          const life = (s - 0.15 - p.k * 0.28) / 2.6;
          if (life <= 0 || life >= 1) {
            p.m.opacity = 0;
            return;
          }
          local.set(Math.sin(life * 6 + p.wob) * 0.08, 0.12 + life * 1.5, -life * 0.45);
          local.applyAxisAngle(up, -cake.rotation.y);
          p.s.position.set(f.tip.x + local.x, f.tip.y + local.y, f.tip.z + local.z);
          p.s.scale.setScalar(0.12 + life * 0.6);
          p.m.opacity = Math.sin(life * Math.PI) * 0.6;
        });
      }
    });

    /* candle light (and the glow in the top of the wax) follows the live flames */
    const flick = 1 + (Math.sin(t * 17) * 0.06 + Math.sin(t * 29) * 0.04) * (1 + b * 3);
    const share = lit / flames.length;
    candleLight.intensity = 2.6 * share * flick * (1 - b * 0.4) * (1 - progress * 0.4);
    candleMat.emissiveIntensity = 1.2 * share * flick * (1 - b * 0.3);

    const t0 = performance.now();
    composer.render(dt);
    // on slow phones drop the AO pass rather than stutter
    if (gtao.enabled && quality !== "high" && performance.now() - t0 > 34) {
      if (++slowFrames > 45) gtao.enabled = false;
    } else slowFrames = Math.max(0, slowFrames - 1);
  };
  frame();

  return {
    setOut(out) {
      if (out) {
        if (outAt == null) outAt = clock.elapsedTime;
        return;
      }
      // light them again ("Try again"): flames back, no ember, no smoke
      outAt = null;
      flames.forEach((f) => {
        f.emberMat.emissiveIntensity = 0;
        f.puffs.forEach((p) => (p.m.opacity = 0));
      });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          ["map", "bumpMap", "normalMap", "emissiveMap"].forEach((k) => m[k]?.dispose());
          m.dispose();
        });
      });
      composer.dispose();
      gtao.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
