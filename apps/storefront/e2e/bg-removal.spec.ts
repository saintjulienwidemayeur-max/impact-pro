import { expect, test } from "@playwright/test";
import { analyzeBorder, contentBounds, cropImage, removeBackground, type Rgb, type RgbaImage } from "../src/lib/bg-removal";

/** Unit tests of the pure background-removal algorithm (no browser involved). */

type Painter = (x: number, y: number) => [number, number, number, number];

function make(w: number, h: number, paint: Painter): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      data.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h };
}

const px = (img: RgbaImage, x: number, y: number): [number, number, number, number] => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const RED: [number, number, number, number] = [200, 30, 50, 255];

/** 60×60 white image, red disc (r=20) at the center with a white hole (r=6). */
const discWithHole = () =>
  make(60, 60, (x, y) => {
    const d = Math.hypot(x - 30, y - 30);
    if (d <= 6) return WHITE;
    if (d <= 20) return RED;
    return WHITE;
  });

test.describe("background removal", () => {
  test("edge mode removes the border background but keeps the enclosed hole", () => {
    const out = removeBackground(discWithHole(), { mode: "edge", tolerance: 28, feather: 0 });
    expect(px(out, 0, 0)[3]).toBe(0);
    expect(px(out, 59, 59)[3]).toBe(0);
    expect(px(out, 30, 12)[3]).toBe(255); // red ring
    expect(px(out, 30, 30)[3]).toBe(255); // white hole preserved
    expect(px(out, 30, 30).slice(0, 3)).toEqual([255, 255, 255]);
  });

  test("global mode removes the colour everywhere (including the hole)", () => {
    const out = removeBackground(discWithHole(), { mode: "global", tolerance: 28, feather: 0 });
    expect(px(out, 0, 0)[3]).toBe(0);
    expect(px(out, 30, 30)[3]).toBe(0);
    expect(px(out, 30, 12)[3]).toBe(255);
  });

  test("tolerance controls how noisy a background is still removed", () => {
    // near-white background with ±5 noise
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 10 - 5;
    const noisy = make(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) <= 10 ? RED : [250 + rnd(), 250 + rnd(), 250 + rnd(), 255]));
    const loose = removeBackground(noisy, { mode: "edge", tolerance: 28, feather: 0 });
    const strict = removeBackground(noisy, { mode: "edge", tolerance: 0, feather: 0 });
    expect(px(loose, 1, 1)[3]).toBe(0);
    expect(px(loose, 20, 20)[3]).toBe(255);
    expect(px(strict, 1, 1)[3]).toBeGreaterThan(0); // nothing matches an exact colour with noise
  });

  test("custom background colour (pipette)", () => {
    const blue: Rgb = [30, 60, 200];
    const img = make(30, 30, (x, y) => (Math.hypot(x - 15, y - 15) <= 8 ? [250, 200, 20, 255] : [30, 60, 200, 255]));
    expect(analyzeBorder(img).color).toEqual(blue);
    // a colour picked inside the artwork (not on the border) is removed everywhere
    const forced = removeBackground(img, { mode: "edge", tolerance: 28, feather: 0, bg: [250, 200, 20] });
    expect(px(forced, 15, 15)[3]).toBe(0);
    expect(px(forced, 0, 0)[3]).toBe(255);
    // the auto-detected border colour removes the blue instead
    const auto = removeBackground(img, { mode: "edge", tolerance: 28, feather: 0 });
    expect(px(auto, 0, 0)[3]).toBe(0);
    expect(px(auto, 15, 15)[3]).toBe(255);
  });

  test("anti-aliased edges get partial alpha and are un-premultiplied (no light halo)", () => {
    const aa = make(41, 41, (x, y) => {
      const cov = Math.min(1, Math.max(0, (11.5 - Math.hypot(x - 20, y - 20)) / 2)); // 2 px soft edge
      return [Math.round(255 + (200 - 255) * cov), Math.round(255 + (30 - 255) * cov), Math.round(255 + (50 - 255) * cov), 255];
    });
    const out = removeBackground(aa, { mode: "edge", tolerance: 28, feather: 0 });
    let partial: [number, number, number, number] | null = null;
    let raw: [number, number, number, number] | null = null;
    for (let x = 0; x < 41 && !partial; x++) {
      const a = px(out, x, 20)[3];
      if (a > 60 && a < 200) {
        partial = px(out, x, 20);
        raw = px(aa, x, 20);
      }
    }
    expect(partial).not.toBeNull();
    expect(partial![1]).toBeLessThan(raw![1]); // greener channel pulled toward the logo colour (less white)
  });

  test("feather smooths edges without growing the logo", () => {
    const sharp = removeBackground(discWithHole(), { mode: "edge", tolerance: 28, feather: 0 });
    const soft = removeBackground(discWithHole(), { mode: "edge", tolerance: 28, feather: 6 });
    const count = (img: RgbaImage) => {
      let n = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 127) n++;
      return n;
    };
    expect(px(soft, 30, 17)[3]).toBe(255);
    expect(px(soft, 0, 0)[3]).toBe(0);
    expect(count(soft)).toBeLessThanOrEqual(count(sharp)); // the half-opaque contour never grows past the original edge
  });

  test("analyzeBorder: uniform / transparent / busy borders", () => {
    expect(analyzeBorder(discWithHole())).toMatchObject({ uniform: true, transparent: false, color: [255, 255, 255] });
    expect(analyzeBorder(make(20, 20, () => [0, 0, 0, 0]))).toMatchObject({ transparent: true, uniform: false });
    const busy = make(20, 20, (x, y) => [(x * 37 + y * 11) % 255, (x * 17) % 255, (y * 29) % 255, 255]);
    expect(analyzeBorder(busy).uniform).toBe(false);
  });

  test("contentBounds + cropImage trim the transparent margin", () => {
    const out = removeBackground(discWithHole(), { mode: "edge", tolerance: 28, feather: 0 });
    const b = contentBounds(out, 8, 0)!;
    expect(b.w).toBeGreaterThanOrEqual(40);
    expect(b.w).toBeLessThanOrEqual(42);
    const cropped = cropImage(out, b);
    expect(cropped.width).toBe(b.w);
    expect(px(cropped, 0, 0)[3]).toBe(0); // disc corner of its bounding box is transparent
    expect(px(cropped, Math.floor(b.w / 2), Math.floor(b.h / 2))[3]).toBe(255);
    expect(contentBounds(make(5, 5, () => [0, 0, 0, 0]))).toBeNull();
  });
});
