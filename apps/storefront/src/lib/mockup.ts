/**
 * Mock-up helpers shared by the final-preview dialog, the downloads and the checkout (order previews):
 * everything that turns « a product + a color + a zone + design elements » into a rendered image.
 */
import { previewFor } from "@/config/product-media";
import { placementLabels, resolveApiUrl, uploadPreview, type Placement } from "./api";
import type { DesignElement } from "./design";
import { canvasToPng, renderMockup, type MockupSource } from "./design-render";

export const elementImageUrl = (el: DesignElement): string | null => (el.upload && el.upload.mimeType.startsWith("image/") ? resolveApiUrl(el.upload.url) : null);

/** Zones (in display order) that carry at least one element. */
export function zonesWithElements(elements: DesignElement[]): Placement[] {
  const order: Placement[] = [];
  for (const e of elements) if (!order.includes(e.placement)) order.push(e.placement);
  return order;
}

export function mockupSourceFor(slug: string, placement: Placement, color: string | undefined, elements: DesignElement[], size?: string): MockupSource & { indicative: boolean } {
  const pv = previewFor(slug, placement, color, size);
  const zoneEls = elements.filter((e) => e.placement === placement);
  const useBlank = zoneEls.length > 0 && Boolean(pv.photo.blank);
  return {
    photoSrc: pv.photo.plain ? "" : useBlank && pv.photo.blank ? pv.photo.blank : pv.photo.src,
    plain: Boolean(pv.photo.plain),
    width: pv.photo.width,
    height: pv.photo.height,
    area: pv.area,
    patch: pv.area.patch,
    useBlank,
    masks: pv.area.masks,
    elements: zoneEls,
    imageUrl: elementImageUrl,
    indicative: pv.indicative,
  };
}

const slugFile = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Builds one PNG « planche » with every zone of a design (2 columns), labelled, ready to share or print.
 * Returns false when the browser cannot export it (a logo served without CORS taints the canvas).
 */
export async function downloadMockupSheet(opts: { productName: string; slug: string; color?: string; size?: string; elements: DesignElement[] }): Promise<boolean> {
  const zones = zonesWithElements(opts.elements);
  if (!zones.length) return false;
  const CELL = 900;
  const PAD = 28;
  const HEAD = 96;
  const CAP = 56;
  const FOOT = 64;
  const results = await Promise.all(zones.map((z) => renderMockup(mockupSourceFor(opts.slug, z, opts.color, opts.elements, opts.size), CELL)));
  if (results.some((r) => !r.exportable)) return false;
  const cols = zones.length > 1 ? 2 : 1;
  const rows = Math.ceil(zones.length / cols);
  const cellH = results.map((r) => r.canvas.height);
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(...cellH.slice(r * cols, r * cols + cols)) + CAP);
  const W = PAD + cols * (CELL + PAD);
  const H = HEAD + rowH.reduce((a, b) => a + b + PAD, 0) + FOOT;
  const sheet = document.createElement("canvas");
  sheet.width = W;
  sheet.height = H;
  const ctx = sheet.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#f2f6f5";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0a716a";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#0e2a2e";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(opts.productName + (opts.color ? ` · ${opts.color}` : ""), PAD, HEAD / 2 + 4);
  let y = HEAD;
  zones.forEach((z, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (c === 0 && i > 0) y += rowH[r - 1] + PAD;
    const x = PAD + c * (CELL + PAD);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, CELL, results[i].canvas.height + CAP);
    ctx.fillStyle = "#0a716a";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText(placementLabels[z] ?? z, x + 16, y + CAP / 2);
    ctx.drawImage(results[i].canvas, x, y + CAP);
  });
  ctx.fillStyle = "#4a6368";
  ctx.font = "400 22px system-ui, sans-serif";
  ctx.fillText("Aperçu indicatif — la maquette définitive vous est envoyée avant production · Impact Pro, Votre marque, partout.", PAD, H - FOOT / 2);
  const blob = await canvasToPng(sheet);
  if (!blob) return false;
  download(blob, `apercu-${slugFile(opts.slug)}.png`);
  return true;
}

export interface LineForPreviews {
  productSlug: string;
  color?: string;
  size?: string;
  elements: DesignElement[];
}

/**
 * Renders one PNG per zone of each cart line and uploads it (POST /uploads/previews). Best effort: any failure
 * (tainted canvas, old API without the endpoint, network) just yields fewer previews — the order never depends on it.
 * Returns, per line, the `{ placement, uploadId }` list to send with the order.
 */
export async function uploadOrderPreviews(lines: LineForPreviews[], budgetMs = 25_000): Promise<{ placement: Placement; uploadId: string }[][]> {
  const out: { placement: Placement; uploadId: string }[][] = lines.map(() => []);
  const started = Date.now();
  const jobs: { li: number; placement: Placement }[] = [];
  lines.forEach((l, li) => zonesWithElements(l.elements).slice(0, 12).forEach((placement) => jobs.push({ li, placement })));
  let next = 0;
  async function worker() {
    while (next < jobs.length && Date.now() - started < budgetMs) {
      const job = jobs[next++];
      try {
        const l = lines[job.li];
        const { canvas, exportable } = await renderMockup(mockupSourceFor(l.productSlug, job.placement, l.color, l.elements, l.size), 1200);
        if (!exportable) continue;
        const blob = await canvasToPng(canvas);
        if (!blob) continue;
        const up = await uploadPreview(new File([blob], `apercu-${slugFile(l.productSlug)}-${job.placement.toLowerCase()}.png`, { type: "image/png" }));
        out[job.li].push({ placement: job.placement, uploadId: up.id });
      } catch {
        // best effort
      }
    }
  }
  await Promise.race([Promise.all([worker(), worker(), worker()]), new Promise((r) => window.setTimeout(r, budgetMs + 2000))]);
  return out;
}
