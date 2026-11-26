/**
 * Client-side background removal for logos (pure functions on RGBA buffers — unit-testable without a browser).
 *
 *  - "edge" mode: flood-fills from the image border through pixels close to the background colour, so enclosed
 *    areas of the same colour (the hole of an "O", white text inside a red disc…) are kept.
 *  - "global" mode: removes that colour everywhere.
 *  - Edge pixels get a soft alpha (anti-aliasing) and are un-premultiplied against the background colour,
 *    so there is no light halo around the logo.
 */

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type Rgb = [number, number, number];

export interface RemoveOptions {
  mode: "edge" | "global";
  /** 0–100 (UI slider). 28 ≈ a colour distance of 62/441. */
  tolerance: number;
  /** 0–10: extra edge smoothing (px). */
  feather: number;
  /** Background colour; defaults to the dominant border colour. */
  bg?: Rgb;
}

export const DEFAULT_TOLERANCE = 28;

const TOL_SCALE = 2.2;

function dist(r: number, g: number, b: number, bg: Rgb): number {
  const dr = r - bg[0];
  const dg = g - bg[1];
  const db = b - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Dominant border colour (median per channel of the opaque border pixels) + how uniform / opaque the border is. */
export function analyzeBorder(img: RgbaImage): { color: Rgb; uniform: boolean; transparent: boolean } {
  const { data, width: w, height: h } = img;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let total = 0;
  let opaque = 0;
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    total++;
    if (data[i + 3] >= 240) {
      opaque++;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  };
  for (let x = 0; x < w; x++) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    take(0, y);
    take(w - 1, y);
  }
  const med = (a: number[]) => (a.length ? a.sort((p, q) => p - q)[a.length >> 1] : 255);
  const color: Rgb = [med(rs), med(gs), med(bs)];
  const transparent = opaque / Math.max(1, total) < 0.6;
  let close = 0;
  for (let k = 0; k < rs.length; k++) if (dist(rs[k], gs[k], bs[k], color) <= 30) close++;
  const uniform = !transparent && close / Math.max(1, rs.length) >= 0.9;
  return { color, uniform, transparent };
}

/** Returns a new RGBA image with the background removed. */
export function removeBackground(img: RgbaImage, opts: RemoveOptions): RgbaImage {
  const { width: w, height: h } = img;
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const bg = opts.bg ?? analyzeBorder(img).color;
  const hi = Math.max(1, opts.tolerance * TOL_SCALE); // distance ≤ hi → background candidate
  const lo = hi * 0.55; // distance ≤ lo → fully transparent
  const n = w * h;
  const isBg = new Uint8Array(n);
  const d = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    // transparent pixels are already "background"
    d[p] = src[i + 3] < 8 ? 0 : dist(src[i], src[i + 1], src[i + 2], bg);
  }

  if (opts.mode === "global") {
    for (let p = 0; p < n; p++) if (d[p] <= hi) isBg[p] = 1;
  } else {
    const stack = new Int32Array(n);
    let sp = 0;
    const push = (p: number) => {
      if (!isBg[p] && d[p] <= hi) {
        isBg[p] = 1;
        stack[sp++] = p;
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < n - w) push(p + w);
    }
  }

  // soft alpha on the background region (pixels between lo and hi keep partial alpha, un-premultiplied)
  const alpha = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a0 = src[i + 3] / 255;
    if (!isBg[p]) {
      alpha[p] = a0;
      continue;
    }
    const a = d[p] <= lo ? 0 : Math.min(1, (d[p] - lo) / (hi - lo));
    alpha[p] = a * a0;
    if (a > 0.02 && a < 1) {
      // C = (P − (1−a)·B) / a
      for (let c = 0; c < 3; c++) {
        const v = (src[i + c] - (1 - a) * bg[c]) / a;
        out[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  if (opts.feather > 0) blurAlpha(alpha, w, h, opts.feather);
  for (let p = 0, i = 3; p < n; p++, i += 4) out[i] = Math.round(alpha[p] * 255);
  return { data: out, width: w, height: h };
}

/** Choke 1 px then box-blur (2 passes) — softens jagged edges without growing the logo. */
function blurAlpha(a: Float32Array, w: number, h: number, feather: number) {
  const radius = Math.max(1, Math.round(feather / 2));
  const tmp = new Float32Array(a.length);
  const pass = (horizontal: boolean) => {
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      for (let k = 0; k < len; k++) {
        let s = 0;
        let c = 0;
        for (let o = -radius; o <= radius; o++) {
          const kk = k + o;
          if (kk < 0 || kk >= len) continue;
          s += horizontal ? a[l * w + kk] : a[kk * w + l];
          c++;
        }
        tmp[horizontal ? l * w + k : k * w + l] = s / c;
      }
    }
    a.set(tmp);
  };
  pass(true);
  pass(false);
  // keep fully opaque interiors opaque after the blur
  for (let p = 0; p < a.length; p++) a[p] = a[p] > 0.97 ? 1 : a[p] < 0.03 ? 0 : a[p];
}

/** Bounding box of pixels with alpha > threshold (with padding); null when the image is empty. */
export function contentBounds(img: RgbaImage, threshold = 8, pad = 2): { x: number; y: number; w: number; h: number } | null {
  const { data, width: w, height: h } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y };
}

export function cropImage(img: RgbaImage, r: { x: number; y: number; w: number; h: number }): RgbaImage {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const s = ((r.y + y) * img.width + r.x) * 4;
    out.set(img.data.subarray(s, s + r.w * 4), y * r.w * 4);
  }
  return { data: out, width: r.w, height: r.h };
}
