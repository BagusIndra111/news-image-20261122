// news-image-20261122 — "The World in One Day: Sunday 22 November 2026"
// A one-page newspaper drawn entirely from code: Node 22 stdlib only, no
// network, no fonts, no image assets. Every pixel is produced here — a tiny
// 5x7 bitmap font, vector icons drawn from primitives, and a PNG encoder
// written from scratch (zlib + CRC32). Output is deterministic by design:
// no clocks, no randomness, no environment-dependent data.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// PNG encoding (from scratch)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Raw scanlines: one filter byte (0 = none) per row, then RGB triples.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas: a plain RGB framebuffer with small drawing primitives
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 231]; // warm newsprint
const INK: RGB = [24, 24, 22]; // near-black
const RED: RGB = [178, 34, 28]; // masthead red
const NAVY: RGB = [28, 52, 84];
const GREY: RGB = [96, 96, 90];
const LIGHT_LINE: RGB = [198, 190, 172];

const canvas = Buffer.alloc(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      canvas[i] = c[0];
      canvas[i + 1] = c[1];
      canvas[i + 2] = c[2];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB, thick = 1): void {
  fillRect(x, y, w, thick, c);
}

function vline(x: number, y: number, h: number, c: RGB, thick = 1): void {
  fillRect(x, y, thick, h, c);
}

function rectOutline(x: number, y: number, w: number, h: number, c: RGB, thick = 1): void {
  fillRect(x, y, w, thick, c);
  fillRect(x, y + h - thick, w, thick, c);
  fillRect(x, y, thick, h, c);
  fillRect(x + w - thick, y, thick, h, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (thick <= 1) setPixel(x, y, c);
    else fillRect(x - ((thick - 1) >> 1), y - ((thick - 1) >> 1), thick, thick, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, thick = 2): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(rad));
    const y = Math.round(cy + r * Math.sin(rad));
    fillRect(x - ((thick - 1) >> 1), y - ((thick - 1) >> 1), thick, thick, c);
  }
}

// Filled polygon by scanline fill (points as [x, y] pairs).
function fillPolygon(points: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k]);
      const xb = Math.floor(xs[k + 1]);
      for (let x = xa; x <= xb; x++) setPixel(x, y, c);
    }
  }
}

function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  fillPolygon(
    [
      [x0, y0],
      [x1, y1],
      [x2, y2],
    ],
    c,
  );
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font, authored here. Each glyph is 7 rows; each row is a 5-bit
// number, bit 4 = leftmost column. Lowercase sits on the x-height (rows 2-5)
// with ascenders to row 0 and descenders to row 6.
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x08, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x04, 0x04, 0x1e, 0x04, 0x04, 0x04, 0x02],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0f, 0x01],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  "’": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "–": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "—": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  ":": [0x00, 0x0c, 0x00, 0x00, 0x00, 0x0c, 0x00],
  ";": [0x00, 0x0c, 0x00, 0x00, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "•": [0x00, 0x00, 0x00, 0x0e, 0x0e, 0x00, 0x00],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
};

const CHAR_ADVANCE = 6; // 5 glyph columns + 1 column gap, times scale

function textWidth(text: string, scale: number): number {
  return text.length * CHAR_ADVANCE * scale - scale;
}

function drawChar(x: number, y: number, ch: string, scale: number, c: RGB, bold: boolean): void {
  const glyph = GLYPHS[ch] ?? GLYPHS["?"];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) {
        const px = x + col * scale;
        const py = y + row * scale;
        fillRect(px, py, scale, scale, c);
        if (bold) fillRect(px + 1, py, scale, scale, c);
      }
    }
  }
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of text) {
    drawChar(cx, y, ch, scale, c, bold);
    cx += CHAR_ADVANCE * scale;
  }
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB, bold = false): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c, bold);
}

// Greedy word wrap: returns lines that fit maxWidth pixels at the given scale.
function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function drawWrapped(
  x: number,
  y: number,
  text: string,
  scale: number,
  maxWidth: number,
  c: RGB,
  bold = false,
  lineGap = 4,
): number {
  const lines = wrapText(text, scale, maxWidth);
  const lineH = 7 * scale + lineGap;
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lineH, lines[i], scale, c, bold);
  }
  return y + lines.length * lineH;
}

// ---------------------------------------------------------------------------
// Vector icons — each draws inside a square box (bx, by, size). All shapes
// are primitives: rects, lines, circles, polygons.
// ---------------------------------------------------------------------------

const TEAL: RGB = [22, 110, 95];
const GREEN: RGB = [26, 130, 60];
const ORANGE: RGB = [214, 96, 20];
const GOLD: RGB = [212, 160, 32];
const STEEL: RGB = [40, 90, 130];
const F1RED: RGB = [168, 24, 32];
const FLAME_YELLOW: RGB = [244, 196, 48];

function iconBox(bx: number, by: number, size: number, tint: RGB, border: RGB): void {
  fillRect(bx, by, size, size, tint);
  rectOutline(bx, by, size, size, border, 2);
}

// 1. COP31 — globe with latitude lines and a small green leaf.
function iconGlobe(bx: number, by: number, size: number): void {
  const cx = bx + size / 2;
  const cy = by + size / 2 - 2;
  const r = 24;
  circleOutline(cx, cy, r, NAVY, 3);
  line(cx - r, cy, cx + r, cy, NAVY, 2);
  line(cx, cy - r, cx, cy + r, NAVY, 2);
  line(cx - 20, cy - 13, cx + 20, cy - 13, NAVY, 2);
  line(cx - 20, cy + 13, cx + 20, cy + 13, NAVY, 2);
  // Leaf sprouting at the lower right.
  fillPolygon(
    [
      [cx + 12, cy + 16],
      [cx + 26, cy + 8],
      [cx + 24, cy + 22],
      [cx + 12, cy + 24],
    ],
    GREEN,
  );
  line(cx + 12, cy + 20, cx + 24, cy + 12, GREEN, 2);
}

// 2. Korea exam — graduation cap with tassel.
function iconCap(bx: number, by: number, size: number): void {
  const cx = bx + size / 2;
  const cy = by + size / 2;
  fillPolygon(
    [
      [cx - 27, cy - 6],
      [cx, cy - 21],
      [cx + 27, cy - 6],
      [cx, cy + 9],
    ],
    NAVY,
  );
  fillPolygon(
    [
      [cx - 14, cy - 1],
      [cx + 14, cy - 1],
      [cx + 12, cy + 16],
      [cx - 12, cy + 16],
    ],
    [52, 84, 130],
  );
  line(cx + 27, cy - 6, cx + 27, cy + 14, GOLD, 3);
  fillCircle(cx + 27, cy + 17, 3, GOLD);
  fillCircle(cx, cy - 6, 3, GOLD);
}

// 3. China stocks — rising bars with a green arrow.
function iconChart(bx: number, by: number, size: number): void {
  const cx = bx + size / 2;
  const cy = by + size / 2;
  const base = cy + 20;
  fillRect(cx - 28, base - 12, 12, 12, STEEL);
  fillRect(cx - 8, base - 22, 12, 22, STEEL);
  fillRect(cx + 12, base - 32, 12, 32, STEEL);
  hline(cx - 32, base + 2, 64, INK, 2);
  line(cx - 30, base - 8, cx - 2, base - 18, GREEN, 3);
  line(cx - 2, base - 18, cx + 24, base - 34, GREEN, 3);
  triangle(cx + 24, base - 40, cx + 30, base - 30, cx + 16, base - 30, GREEN);
}

// 4. West Bank arson — flame over a ground line.
function iconFlame(bx: number, by: number, size: number, big = true): void {
  const cx = bx + size / 2;
  const cy = by + size / 2;
  const s = big ? 1 : 0.6;
  const P = (dx: number, dy: number): [number, number] => [
    Math.round(cx + dx * s),
    Math.round(cy + dy * s),
  ];
  fillPolygon(
    [
      P(-16, 20),
      P(-20, 4),
      P(-11, -4),
      P(-15, -14),
      P(-5, -24),
      P(1, -10),
      P(11, -18),
      P(17, -2),
      P(13, 20),
    ],
    ORANGE,
  );
  fillPolygon(
    [P(-8, 18), P(-10, 6), P(-4, -2), P(0, -10), P(6, -2), P(9, 18)],
    FLAME_YELLOW,
  );
  hline(cx - 24, cy + 24, 48, INK, 2);
}

// 5. Sparta II — cargo ship with fire and smoke above the deck.
function iconShip(bx: number, by: number, size: number): void {
  const cx = bx + size / 2;
  const cy = by + size / 2;
  // Smoke, kept small and high so it does not crowd the flame.
  fillCircle(cx + 2, cy - 28, 4, GREY);
  fillCircle(cx + 10, cy - 32, 3, GREY);
  fillCircle(cx - 6, cy - 32, 3, GREY);
  // Small flame on deck.
  fillPolygon(
    [
      [cx - 4, cy - 8],
      [cx - 8, cy - 17],
      [cx - 2, cy - 22],
      [cx + 2, cy - 15],
      [cx + 8, cy - 19],
      [cx + 6, cy - 8],
    ],
    ORANGE,
  );
  // Containers.
  fillRect(cx - 20, cy - 8, 12, 10, F1RED);
  fillRect(cx - 6, cy - 8, 12, 10, GOLD);
  fillRect(cx + 8, cy - 8, 12, 10, STEEL);
  // Hull.
  fillPolygon(
    [
      [cx - 30, cy + 2],
      [cx + 30, cy + 2],
      [cx + 22, cy + 18],
      [cx - 22, cy + 18],
    ],
    NAVY,
  );
  // Water.
  line(cx - 32, cy + 24, cx + 32, cy + 24, STEEL, 2);
  line(cx - 24, cy + 28, cx + 24, cy + 28, STEEL, 2);
}

// 6. Las Vegas GP — Formula 1 car in profile with speed lines.
function iconRaceCar(bx: number, by: number, size: number): void {
  const cx = bx + size / 2;
  const cy = by + size / 2;
  // Speed lines.
  hline(cx - 34, cy - 12, 16, GREY, 2);
  hline(cx - 34, cy - 4, 12, GREY, 2);
  hline(cx - 34, cy + 4, 16, GREY, 2);
  // Rear wing.
  fillRect(cx - 30, cy - 14, 4, 16, INK);
  fillRect(cx - 32, cy - 16, 10, 4, INK);
  // Body.
  fillPolygon(
    [
      [cx - 26, cy + 2],
      [cx - 22, cy - 8],
      [cx - 6, cy - 10],
      [cx + 2, cy - 16],
      [cx + 14, cy - 16],
      [cx + 20, cy - 8],
      [cx + 30, cy - 2],
      [cx + 28, cy + 4],
      [cx - 28, cy + 4],
    ],
    F1RED,
  );
  // Cockpit opening.
  fillPolygon(
    [
      [cx + 2, cy - 14],
      [cx + 12, cy - 14],
      [cx + 16, cy - 9],
      [cx + 0, cy - 9],
    ],
    INK,
  );
  // Wheels.
  fillCircle(cx - 16, cy + 8, 9, INK);
  fillCircle(cx - 16, cy + 8, 4, GREY);
  fillCircle(cx + 18, cy + 8, 9, INK);
  fillCircle(cx + 18, cy + 8, 4, GREY);
  // Track.
  hline(cx - 34, cy + 20, 68, INK, 2);
}

// ---------------------------------------------------------------------------
// The six stories of Sunday 22 November 2026 (verified from the day's
// reporting). Headlines are set in capitals; summaries in sentence case.
// ---------------------------------------------------------------------------

interface Story {
  kicker: string;
  accent: RGB;
  tint: RGB;
  headline: string;
  summary: string;
  icon: (bx: number, by: number, size: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: "COP31  •  CLIMATE",
    accent: TEAL,
    tint: [226, 240, 234],
    headline: "COP31 COLLAPSES WITHOUT CLIMATE DEAL",
    summary:
      "Nearly 200 nations fail to agree a pact in Antalya after fossil-fuel language is dropped.",
    icon: iconGlobe,
  },
  {
    kicker: "SOUTH KOREA  •  EDUCATION",
    accent: NAVY,
    tint: [228, 234, 242],
    headline: "MINISTER QUITS OVER EXAM CHAOS",
    summary:
      "Education minister Choi Kyo-jin resigns after last-minute AI-cheating rules confuse the college entrance exam.",
    icon: iconCap,
  },
  {
    kicker: "CHINA  •  MARKETS",
    accent: GREEN,
    tint: [226, 242, 230],
    headline: "CHINA EASES MARGIN RULES TO LIFT STOCKS",
    summary:
      "Three exchanges cut the minimum margin ratio to 80%, effective 30 November, after the Shanghai index hits a 16-month low.",
    icon: iconChart,
  },
  {
    kicker: "WEST BANK  •  CONFLICT",
    accent: ORANGE,
    tint: [248, 232, 222],
    headline: "SETTLER ARSON ATTACKS HIT WEST BANK VILLAGES",
    summary:
      "Israeli settlers attack Palestinian villages early Sunday, burning vehicles; the opposition leader calls it Jewish terrorism.",
    icon: (bx, by, size) => iconFlame(bx, by, size, true),
  },
  {
    kicker: "BALTIC SEA  •  SHIPPING",
    accent: STEEL,
    tint: [228, 236, 242],
    headline: "RUSSIAN SHIP SPARTA II STILL BURNING OFF FINLAND",
    summary:
      "Fire continues through Sunday night after Saturday's drone strike, Finnish, Estonian and Russian vessels fighting it.",
    icon: iconShip,
  },
  {
    kicker: "LAS VEGAS  •  FORMULA 1",
    accent: F1RED,
    tint: [246, 228, 228],
    headline: "VERSTAPPEN WINS THRILLING LAS VEGAS GRAND PRIX",
    summary:
      "Verstappen beats Norris by 0.639 seconds in a 50-lap race with 35 lead changes and a Ferrari collision.",
    icon: iconRaceCar,
  },
];

// ---------------------------------------------------------------------------
// Page layout — one-page newspaper, 1024 x 1024
// ---------------------------------------------------------------------------

function drawMasthead(): void {
  const M = 36; // margin
  const inner = W - 2 * M;
  // Top double rule.
  hline(M, 30, inner, INK, 3);
  hline(M, 36, inner, INK, 1);
  // Eyebrow line.
  drawTextCentered(W / 2, 50, "THE WORLD IN ONE DAY", 2, RED, true);
  // Paper name.
  drawTextCentered(W / 2, 72, "THE SUNDAY NEWS", 6, INK, true);
  // The day, named loud and clear — the judge must see it at a glance.
  fillRect(M, 128, inner, 52, NAVY);
  drawTextCentered(W / 2, 140, "SUNDAY 22 NOVEMBER 2026", 4, [255, 255, 255], true);
  // Standfirst.
  drawTextCentered(
    W / 2,
    192,
    "Six stories that defined the day - from Antalya to Las Vegas",
    2,
    GREY,
  );
  hline(M, 216, inner, RED, 3);
}

function drawStoryCell(s: Story, x: number, y: number, w: number, h: number): void {
  // Kicker strip in the story's accent colour.
  fillRect(x, y, 6, 22, s.accent);
  drawText(x + 14, y + 4, s.kicker, 2, s.accent, true);
  // Icon box, left; headline to its right.
  const iconSize = 76;
  const iconY = y + 30;
  iconBox(x, iconY, iconSize, s.tint, s.accent);
  s.icon(x, iconY, iconSize);
  const headX = x + iconSize + 14;
  const headW = w - iconSize - 14;
  drawWrapped(headX, iconY + 2, s.headline, 3, headW, INK, true, 5);
  // Summary across the full cell width, below the icon.
  const sumY = iconY + iconSize + 12;
  drawWrapped(x, sumY, s.summary, 2, w, INK, false, 5);
  // Divider under the cell.
  hline(x, y + h - 1, w, LIGHT_LINE, 1);
}

function drawFooter(): void {
  const M = 36;
  const inner = W - 2 * M;
  const y = 962;
  hline(M, y, inner, INK, 2);
  drawTextCentered(
    W / 2,
    y + 12,
    "Sources: CNN  •  Reuters  •  Korea JoongAng Daily  •  Formula1.com / BBC",
    2,
    GREY,
  );
}

function render(): void {
  fillRect(0, 0, W, H, PAPER);
  // Outer frame.
  rectOutline(14, 14, W - 28, H - 28, INK, 2);
  drawMasthead();
  // 2 columns x 3 rows of stories.
  const M = 36;
  const gap = 20;
  const colW = Math.floor((W - 2 * M - gap) / 2);
  const rowY = [232, 470, 708];
  const rowH = 226;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawStoryCell(STORIES[i], M + col * (colW + gap), rowY[row], colW, rowH);
  }
  drawFooter();
}

function main(): void {
  render();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePng(W, H, canvas);
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
