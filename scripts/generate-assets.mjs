/**
 * Writes tasteful placeholder images so the page looks finished before the
 * real photos are in. Swap them by dropping files into /public/images:
 *
 *   hero.jpg               the portrait on the countdown / welcome screen
 *   image1.jpg … image6.jpg  the memories slideshow
 *   cake.png               optional cut-out cake photo (replaces the drawn one)
 *
 * The .jpg is always preferred; the generated .svg is only the fallback.
 * Audio is optional too — drop real mp3s into /public/audio (see lib/config.js).
 *
 * Run with:  npm run assets
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const imageDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");
mkdirSync(imageDir, { recursive: true });

/** Lilac / cream / butter pairs that match the lavender cake theme. */
const TONES = [
  ["#e6dcf6", "#fff3dc"],
  ["#d9c6f0", "#f6e9f3"],
  ["#fff1c9", "#e6dcf6"],
  ["#efe3f7", "#dccbee"],
  ["#f8ecd9", "#d9c6f0"],
  ["#e4d4f2", "#fff6e0"],
];

const frame = (w, h, [c1, c2], label, glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="light" cx=".3" cy=".22" r=".85">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(w / 14)}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#light)"/>
  <circle cx="${w * 0.78}" cy="${h * 0.2}" r="${w * 0.16}" fill="#ffffff" opacity=".45" filter="url(#blur)"/>
  <circle cx="${w * 0.2}" cy="${h * 0.82}" r="${w * 0.22}" fill="#ffffff" opacity=".35" filter="url(#blur)"/>
  <text x="${w / 2}" y="${h / 2 - h * 0.02}" text-anchor="middle" font-family="Verdana, sans-serif"
        font-size="${Math.round(w / 9)}" fill="#ffffff" fill-opacity=".95">${glyph}</text>
  <text x="${w / 2}" y="${h / 2 + h * 0.08}" text-anchor="middle" font-family="Verdana, sans-serif"
        font-size="${Math.round(w / 26)}" fill="#7d57ad" fill-opacity=".8">${label}</text>
</svg>`;

writeFileSync(join(imageDir, "hero.svg"), frame(640, 800, ["#d9c6f0", "#fff3dc"], "add hero.jpg", "✦"));
console.log("image   hero.svg");

TONES.forEach((tone, i) => {
  const n = i + 1;
  writeFileSync(join(imageDir, `image${n}.svg`), frame(700, 700, tone, `add image${n}.jpg`, "❀"));
  console.log("image  ", `image${n}.svg`);
});
