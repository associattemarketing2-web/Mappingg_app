// Draws the live-map pin images (assets/pins/*.png) — the same teardrop pin the
// website draws with CSS (public-map: .pin-wrap / .pin-circle / .pin-tail /
// .pin-ground): a 28px status-coloured head with a white 2px border, a 15px
// tail, a soft ground shadow — at 1x, 2x and 3x for every screen density.
//
//   node scripts/build-pin-icons.mjs
//
// Two variants per status:
//   pin-<status>.png       head with a white face (the project logo is drawn on top)
//   pin-<status>-dot.png   head with the website's white "●" glyph (no logo)
// No dependencies: a tiny supersampled rasterizer + PNG encoder.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const STATUS = { available: '#3f8f6b', sold: '#b5484c', construction: '#c98a2c', upcoming: '#3b6ea5' };
const SS = 4; // supersamples per axis
// CSS box is 32x44. Pad 4px left/right/top so the head's shadow isn't clipped;
// the pin's tip stays on the bottom edge (icon-anchor: bottom).
const PAD = 4;
const W = 32 + PAD * 2;
const H = 44 + PAD;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function render(color, face, SCALE) {
  const w = W * SCALE;
  const h = H * SCALE;
  const px = new Float64Array(w * h * 4); // premultiplied RGBA 0..1
  const [cr, cg, cb] = hex(color).map((v) => v / 255);

  // Coverage-based "over" compositing of a shape given an inside(x,y) test in CSS px.
  function paint(inside, r, g, b, a, blur = 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let cov = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const X = (x + (sx + 0.5) / SS) / SCALE - PAD;
            const Y = (y + (sy + 0.5) / SS) / SCALE - PAD;
            cov += blur ? inside(X, Y) : inside(X, Y) ? 1 : 0;
          }
        }
        cov /= SS * SS;
        if (cov <= 0) continue;
        const sa = a * cov;
        const i = (y * w + x) * 4;
        px[i] = r * sa + px[i] * (1 - sa);
        px[i + 1] = g * sa + px[i + 1] * (1 - sa);
        px[i + 2] = b * sa + px[i + 2] * (1 - sa);
        px[i + 3] = sa + px[i + 3] * (1 - sa);
      }
    }
  }
  // Soft shape: smooth falloff of `spread` px around a signed distance function.
  const soft = (sdf, spread) => (X, Y) => {
    const d = sdf(X, Y);
    if (d <= -spread) return 1;
    if (d >= spread) return 0;
    const t = (d + spread) / (2 * spread);
    return 1 - t * t * (3 - 2 * t);
  };
  const circleSdf = (cx, cy, r) => (X, Y) => Math.hypot(X - cx, Y - cy) - r;
  const inCircle = (cx, cy, r) => (X, Y) => (X - cx) ** 2 + (Y - cy) ** 2 <= r * r;
  // Tail: CSS border triangle, top edge 14px wide at y=22, tip at y=37, centred.
  const inTail = (dy = 0) => (X, Y) => {
    const y = Y - dy;
    if (y < 22 || y > 37) return false;
    const half = 7 * (1 - (y - 22) / 15);
    return Math.abs(X - 16) <= half;
  };

  // .pin-ground: 10x4 ellipse, bottom 1px, rgba(0,0,0,.28), blur 1px
  paint(soft((X, Y) => (Math.hypot((X - 16) / 5, (Y - 41) / 2) - 1) * 2, 1), 0, 0, 0, 0.28, 1);
  // tail drop-shadow(0 2px 1px rgba(0,0,0,.25))
  paint(inTail(2), 0, 0, 0, 0.25);
  // tail (currentColor)
  paint(inTail(0), cr, cg, cb, 1);
  // head box-shadow: 0 3px 7px rgba(0,0,0,.35)
  paint(soft(circleSdf(16, 17, 14), 3.5), 0, 0, 0, 0.35, 1);
  // head: 28px circle, 2px rgba(255,255,255,.9) border over the status colour
  paint(inCircle(16, 14, 14), cr, cg, cb, 1);
  paint((X, Y) => inCircle(16, 14, 14)(X, Y) && !inCircle(16, 14, 12)(X, Y), 1, 1, 1, 0.9);
  if (face) paint(inCircle(16, 14, 11), 1, 1, 1, 1); // white face behind the logo
  else paint(inCircle(16, 14, 4.2), 1, 1, 1, 1); // the "●" glyph

  // un-premultiply → 8-bit RGBA rows with filter byte 0
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3];
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round((px[i] / a) * 255) : 0;
      raw[o + 1] = a ? Math.round((px[i + 1] / a) * 255) : 0;
      raw[o + 2] = a ? Math.round((px[i + 2] / a) * 255) : 0;
      raw[o + 3] = Math.round(a * 255);
    }
  }
  return png(w, h, raw);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pins');
mkdirSync(out, { recursive: true });
for (const [status, color] of Object.entries(STATUS)) {
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    writeFileSync(join(out, `pin-${status}${suffix}.png`), render(color, true, scale));
    writeFileSync(join(out, `pin-${status}-dot${suffix}.png`), render(color, false, scale));
  }
}
console.log(`Pin icons written to ${out} (${W}x${H} pt at 1x/2x/3x)`);
