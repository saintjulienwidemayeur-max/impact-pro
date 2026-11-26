import type { PrintPlacement } from '@prisma/client';

/** French display labels for print zones (contract §1). */
export const PLACEMENT_LABELS: Record<PrintPlacement, string> = {
  FRONT: 'Devant',
  BACK: 'Dos',
  CHEST_LEFT: 'Cœur (poitrine gauche)',
  SLEEVE: 'Manche',
  WRAP: 'Tour complet',
  FULL: 'Pleine surface',
  SIDE: 'Côté',
  TOP: 'Dessus / toit',
};

/** Max number of design elements (logos, texts, artwork) per print zone. */
export const MAX_ELEMENTS_PER_ZONE = 10;

/** Allowed text fonts (ids shared with the storefront; contract §4). */
export const TEXT_FONTS = ['fredoka', 'inter', 'pacifico', 'bebas-neue', 'playfair', 'montserrat', 'dancing-script', 'oswald'] as const;
export type TextFont = (typeof TEXT_FONTS)[number];

export interface CustomSizeConfig {
  minWidthCm: number;
  maxWidthCm: number;
  minHeightCm: number;
  maxHeightCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  minBillableM2: number;
}

/** Narrows the Product.customSize JSON column to a well-formed config, or null. */
export function parseCustomSize(raw: unknown): CustomSizeConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const keys = ['minWidthCm', 'maxWidthCm', 'minHeightCm', 'maxHeightCm', 'defaultWidthCm', 'defaultHeightCm', 'minBillableM2'] as const;
  const out: Partial<CustomSizeConfig> = {};
  for (const k of keys) {
    const v = r[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    out[k] = v;
  }
  return out as CustomSizeConfig;
}
