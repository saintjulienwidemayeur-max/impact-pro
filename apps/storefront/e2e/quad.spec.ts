import { expect, test } from "@playwright/test";
import { applyH, cssMatrix3d, invertH, quadBox, quadToFlat, squareToQuad, warpToQuad, type Quad } from "../src/lib/quad";

/** Unit tests of the pure perspective mapping (no browser involved). */

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const pt = (p: [number, number], x: number, y: number, eps = 1e-6) => {
  close(p[0], x, eps);
  close(p[1], y, eps);
};

// a real perspective quad: the far edge (top) is shorter than the near edge (bottom)
const Q: Quad = [
  [120, 40],
  [300, 70],
  [330, 260],
  [90, 240],
];

test.describe("quad perspective mapping", () => {
  test("the unit-square corners land exactly on the quad corners", () => {
    const H = squareToQuad(Q);
    pt(applyH(H, 0, 0), 120, 40);
    pt(applyH(H, 1, 0), 300, 70);
    pt(applyH(H, 1, 1), 330, 260);
    pt(applyH(H, 0, 1), 90, 240);
  });

  test("a parallelogram maps affinely (center = centroid)", () => {
    const P: Quad = [
      [0, 0],
      [100, 20],
      [120, 70],
      [20, 50],
    ];
    const H = squareToQuad(P);
    pt(applyH(H, 0.5, 0.5), 60, 35);
    expect(H[6]).toBe(0);
    expect(H[7]).toBe(0);
  });

  test("the center of a perspective quad is the intersection of its diagonals, not the vertex average", () => {
    const H = squareToQuad(Q);
    const c = applyH(H, 0.5, 0.5);
    // intersection of diagonals TL–BR and TR–BL
    const [[x1, y1], , [x3, y3]] = Q;
    const [x2, y2] = Q[1];
    const [x4, y4] = Q[3];
    const d = (x1 - x3) * (y2 - y4) - (y1 - y3) * (x2 - x4);
    const ix = ((x1 * y3 - y1 * x3) * (x2 - x4) - (x1 - x3) * (x2 * y4 - y2 * x4)) / d;
    const iy = ((x1 * y3 - y1 * x3) * (y2 - y4) - (y1 - y3) * (x2 * y4 - y2 * x4)) / d;
    pt(c, ix, iy, 1e-6);
  });

  test("inverse maps frame points back to the unit square and quadToFlat scales to the flat box", () => {
    const H = squareToQuad(Q);
    const inv = invertH(H);
    pt(applyH(inv, 120, 40), 0, 0);
    pt(applyH(inv, 330, 260), 1, 1);
    const [u, v] = applyH(H, 0.3, 0.8);
    pt(applyH(inv, u, v), 0.3, 0.8);
    pt(quadToFlat(Q, 400, 200, u, v), 0.3 * 400, 0.8 * 200);
  });

  test("css matrix3d sends the flat box corners to the quad corners", () => {
    const m = /matrix3d\((.*)\)/.exec(cssMatrix3d(Q, 400, 200))![1].split(",").map(Number);
    // column-major 4×4 → apply to (x, y, 0, 1) and divide by w
    const apply = (x: number, y: number): [number, number] => {
      const X = m[0] * x + m[4] * y + m[12];
      const Y = m[1] * x + m[5] * y + m[13];
      const W = m[3] * x + m[7] * y + m[15];
      return [X / W, Y / W];
    };
    pt(apply(0, 0), 120, 40, 1e-5);
    pt(apply(400, 0), 300, 70, 1e-5);
    pt(apply(400, 200), 330, 260, 1e-5);
    pt(apply(0, 200), 90, 240, 1e-5);
  });

  test("quadBox returns an equivalent box (width = mean of top/bottom edges, height from the aspect)", () => {
    const b = quadBox(Q, 2);
    const top = Math.hypot(300 - 120, 70 - 40);
    const bottom = Math.hypot(330 - 90, 260 - 240);
    close(b.w, (top + bottom) / 2);
    close(b.h, b.w / 2);
    expect(Math.abs(b.rot)).toBeLessThan(20);
  });

  test("warpToQuad draws every mesh triangle with the expected affine transform and clip", () => {
    // minimal recording context: the destination of the flat corner (0,0) must be the quad's TL corner
    const calls: { m: number[]; moves: [number, number][] }[] = [];
    let current: { m: number[]; moves: [number, number][] } | null = null;
    const ctx = {
      save: () => undefined,
      restore: () => {
        if (current) calls.push(current);
        current = null;
      },
      beginPath: () => {
        current = { m: [], moves: [] };
      },
      moveTo: (x: number, y: number) => current?.moves.push([x, y]),
      lineTo: (x: number, y: number) => current?.moves.push([x, y]),
      closePath: () => undefined,
      clip: () => undefined,
      transform: (...m: number[]) => {
        if (current) current.m = m;
      },
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    warpToQuad(ctx, {} as CanvasImageSource, 400, 200, Q, 4);
    expect(calls).toHaveLength(4 * 4 * 2);
    // every recorded affine maps its source vertex (0,0)/(w,0)/(0,h)… consistently: check the first triangle (source (0,0),(100,0),(0,50))
    const [a, b, c, d, e, f] = calls[0].m;
    const mapped = (x: number, y: number): [number, number] => [a * x + c * y + e, b * x + d * y + f];
    pt(mapped(0, 0), 120, 40, 1e-6); // TL corner
    const H = squareToQuad(Q);
    pt(mapped(100, 0), ...applyH(H, 0.25, 0), 1e-6);
    pt(mapped(0, 50), ...applyH(H, 0, 0.25), 1e-6);
  });
});
