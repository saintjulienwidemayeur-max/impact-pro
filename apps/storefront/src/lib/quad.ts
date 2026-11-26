/**
 * Perspective helpers for print areas given as a quadrilateral (docs/customizer-v2-contract.md §7.3).
 * Pure functions (no DOM) except `warpToQuad`, which only needs a 2D context.
 *
 * A quad is [TL, TR, BR, BL] in any consistent unit. The flat print area is the unit square
 * (u, v) ∈ [0,1]² with (0,0) = TL, (1,0) = TR, (1,1) = BR, (0,1) = BL.
 */

export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt];
/** Row-major 3×3 homography [a b c; d e f; g h 1]. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Homography that maps the unit square onto the quad (Heckbert's square-to-quad). */
export function squareToQuad(q: Quad): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // parallelogram: affine
    return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1];
  }
  const den = dx1 * dy2 - dy1 * dx2;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dy1 * dx3) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function applyH(H: Homography, u: number, v: number): Pt {
  const w = H[6] * u + H[7] * v + H[8];
  return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w];
}

export function invertH(H: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);

export function quadEdges(q: Quad): { top: number; bottom: number; left: number; right: number } {
  return { top: dist(q[0], q[1]), bottom: dist(q[3], q[2]), left: dist(q[0], q[3]), right: dist(q[1], q[2]) };
}

export function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  return q.map(([x, y]) => [x * sx, y * sy] as Pt) as Quad;
}

export function quadCentroid(q: Quad): Pt {
  return [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
}

/**
 * CSS `matrix3d(...)` that maps a `w × h` box (transform-origin 0 0) onto the quad (same units as the quad).
 * Lets an overlay of flat print-area coordinates sit exactly on the perspective surface.
 */
export function cssMatrix3d(q: Quad, w: number, h: number): string {
  const H = squareToQuad(q);
  // H' = H · diag(1/w, 1/h, 1)
  const m = [H[0] / w, H[1] / h, H[2], H[3] / w, H[4] / h, H[5], H[6] / w, H[7] / h, H[8]];
  const n = (x: number) => Number(x.toFixed(9));
  return `matrix3d(${[m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]].map(n).join(",")})`;
}

/** Maps a point of the quad's plane (frame coordinates) back to flat print-area coordinates in [0,w]×[0,h]. */
export function quadToFlat(q: Quad, w: number, h: number, x: number, y: number): Pt {
  const [u, v] = applyH(invertH(squareToQuad(q)), x, y);
  return [u * w, v * h];
}

/**
 * Draws `src` (the flat print area) onto the quad with a subdivided-triangle perspective warp:
 * a `grid × grid` mesh whose vertices follow the homography, each triangle drawn with its own affine transform and
 * clipped (grown by ~0.75 px to hide seams).
 */
export function warpToQuad(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  quad: Quad,
  grid = 12,
): void {
  const H = squareToQuad(quad);
  const n = Math.max(2, Math.round(grid));
  const dst: Pt[][] = [];
  for (let j = 0; j <= n; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= n; i++) row.push(applyH(H, i / n, j / n));
    dst.push(row);
  }
  const tri = (s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt) => {
    // affine M with M·s = d for the three vertices
    const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(det) < 1e-9) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det;
    const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
    const e = d0[0] - a * s0[0] - c * s0[1];
    const f = d0[1] - b * s0[0] - d * s0[1];
    const cx = (d0[0] + d1[0] + d2[0]) / 3;
    const cy = (d0[1] + d1[1] + d2[1]) / 3;
    const grow = (p: Pt): Pt => {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] + (dx / len) * 0.75, p[1] + (dy / len) * 0.75];
    };
    const g0 = grow(d0);
    const g1 = grow(d1);
    const g2 = grow(d2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g0[0], g0[1]);
    ctx.lineTo(g1[0], g1[1]);
    ctx.lineTo(g2[0], g2[1]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const s00: Pt = [(i / n) * srcW, (j / n) * srcH];
      const s10: Pt = [((i + 1) / n) * srcW, (j / n) * srcH];
      const s01: Pt = [(i / n) * srcW, ((j + 1) / n) * srcH];
      const s11: Pt = [((i + 1) / n) * srcW, ((j + 1) / n) * srcH];
      tri(s00, s10, s01, dst[j][i], dst[j][i + 1], dst[j + 1][i]);
      tri(s10, s11, s01, dst[j][i + 1], dst[j + 1][i + 1], dst[j + 1][i]);
    }
  }
}

/** Geometry derived from a quad + the flat aspect (w / h): the equivalent box used by the generic code (cover scale…). */
export function quadBox(q: Quad, aspect: number): { cx: number; cy: number; w: number; h: number; rot: number } {
  const e = quadEdges(q);
  const w = (e.top + e.bottom) / 2;
  const [cx, cy] = quadCentroid(q);
  const rot = (Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]) * 180) / Math.PI;
  return { cx, cy, w, h: w / aspect, rot };
}
