/**
 * Product photography (from the Impact Pro brand book and promo kit) and live-preview print areas.
 * This is presentation config, not catalog data: names, prices and options come from the API.
 */
import { placementLabels, type Placement, type Product } from "@/lib/api";
import printAreasJson from "./print-areas.json";
import newMediaJson from "./new-products-media.json";
import { quadBox, type Quad } from "@/lib/quad";

export interface PrintArea {
  /** Center, as a fraction of the photo width / height. */
  cx: number;
  cy: number;
  /** Box size, both as a fraction of the photo WIDTH (keeps aspect when the box is rotated). */
  w: number;
  h: number;
  rot: number;
  /** Perspective print area: [TL, TR, BR, BL] as fractions of the photo width / height. cx/cy/w/h/rot are then derived. */
  quad?: [[number, number], [number, number], [number, number], [number, number]];
  /** Aspect (w / h) of the flat print area mapped onto `quad`. */
  aspect?: number;
  /** Surface curvature for a realistic wrap: `phi` = half-angle of the visible cylinder (rad), `arch` = vertical bow (fraction of height, + = center lower). */
  curve?: { phi: number; arch: number };
  /** Surface color used to mask the sample logo already printed on the photo (null = no mask). */
  patch: string | null;
  /** Extra masks for sample logos elsewhere on the photo (same units, unrotated). */
  masks?: { cx: number; cy: number; w: number; h: number; patch: string }[];
}

export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Same photo without the sample logo printed on it (used as the base of the live preview). */
  blank?: string;
  /** Not a photo: a neutral print-area frame (products without photography yet). */
  plain?: boolean;
}

const p = (file: string, alt: string, width: number, height: number, blank?: string): Photo => ({
  src: `/photos/${file}`,
  alt,
  width,
  height,
  ...(blank ? { blank: `/photos/${blank}` } : {}),
});

export const photos = {
  tasse: p("tasse-11oz.webp", "Tasse céramique blanche 11 oz avec logo imprimé", 1400, 1620, "tasse-11oz-blank.webp"),
  tasses: p("tasses-serie.webp", "Deux tasses blanches personnalisées, icône et logo", 1400, 966),
  poloBlanc: p("polo-blanc-brode.webp", "Polo blanc avec logo brodé côté cœur", 1255, 1737, "polo-blanc-brode-blank.webp"),
  poloTeal: p("polo-equipe-teal.webp", "Polo d'équipe teal, vue devant et dos avec logo", 1400, 855, "polo-equipe-teal-blank.webp"),
  casquette: p("casquette-brodee.webp", "Casquette blanche avec logo brodé en façade", 1400, 1268, "casquette-brodee-blank.webp"),
  banderole: p("banderole-pvc.jpg", "Banderole PVC extérieure 3 × 1,2 m installée avec œillets", 1400, 1295),
  drapeaux: p("drapeaux-plume.webp", "Trois drapeaux plume blanc, teal et jaune", 1400, 942),
  carteRecto: p("carte-visite-recto.jpg", "Carte de visite recto, fond teal avec logo", 1400, 793),
  carteVerso: p("carte-visite-verso.jpg", "Carte de visite verso avec coordonnées et icône", 1400, 794),
  entete: p("papier-entete.jpg", "Papier à en-tête A4 avec logo et coordonnées", 1250, 1768),
  carnet: p("carnet-a5.webp", "Carnet A5 teal avec logo en sérigraphie", 1238, 1506, "carnet-a5-blank.webp"),
  stylos: p("stylos.webp", "Stylos blancs marqués en tampographie", 1094, 1506, "stylos-blank.webp"),
  etiquettes: p("etiquettes-sceaux.jpg", "Étiquettes rondes « Merci ! » et sceau avec icône", 1008, 469),
  photocallEvent: p("photocall-evenement.jpg", "Photocall installé lors d'un événement, motif step & repeat", 1400, 1295),
  photocallFichier: p("photocall-fichier.jpg", "Fichier d'impression du photocall 3 × 2,25 m", 1400, 1050),
  kit: p("kit-promotionnel.webp", "Kit promotionnel : parapluie, polo, sac, gourde, casquette, clé USB et porte-clés avec logo", 736, 736),
  equipements: p("equipements-impression.webp", "Imprimantes grand format et numériques avec banderole, covering de véhicule, brochures et flyers imprimés", 1472, 1370),
  reseaux: p("couverture-reseaux.jpg", "Couverture réseaux sociaux Impact Pro", 1400, 492),
} satisfies Record<string, Photo>;

export interface ProductMedia {
  gallery: Photo[];
  /** Which photo previews each placement. */
  previews: Partial<Record<Placement, Photo>>;
  /** Overrides by color keyword (matched case/accent-insensitively against the selected color). */
  colorPreviews?: Record<string, Partial<Record<Placement, Photo>>>;
  /** Placements previewed on a photo that does not really show that side (flagged « aperçu indicatif »). */
  approx?: Placement[];
}

const media: Record<string, ProductMedia> = {
  "tasse-ceramique-11oz": {
    gallery: [photos.tasse, photos.tasses],
    previews: { FRONT: photos.tasse, WRAP: photos.tasse },
  },
  "polo-brode": {
    gallery: [photos.poloBlanc, photos.poloTeal],
    previews: { CHEST_LEFT: photos.poloBlanc, FRONT: photos.poloBlanc }, // BACK / SLEEVE on white: indicative
    colorPreviews: { teal: { CHEST_LEFT: photos.poloTeal, FRONT: photos.poloTeal, BACK: photos.poloTeal, SLEEVE: photos.poloTeal } },
  },
  "t-shirt-personnalise": {
    gallery: [photos.poloTeal, photos.poloBlanc],
    previews: { FRONT: photos.poloTeal, BACK: photos.poloTeal, CHEST_LEFT: photos.poloTeal, SLEEVE: photos.poloTeal },
    colorPreviews: { blanc: { FRONT: photos.poloBlanc, CHEST_LEFT: photos.poloBlanc } },
  },
  "casquette-brodee": { gallery: [photos.casquette], previews: { FRONT: photos.casquette } }, // SIDE / BACK: indicative (front photo)
  "banderole-pvc": { gallery: [photos.banderole], previews: { FRONT: photos.banderole, FULL: photos.banderole } },
  "drapeau-plume": { gallery: [photos.drapeaux], previews: { FRONT: photos.drapeaux, FULL: photos.drapeaux } },
  "cartes-de-visite": {
    gallery: [photos.carteRecto, photos.carteVerso],
    previews: { FRONT: photos.carteRecto, BACK: photos.carteVerso },
  },
  "papier-en-tete": { gallery: [photos.entete], previews: { FRONT: photos.entete } },
  "carnet-a5": { gallery: [photos.carnet], previews: { FRONT: photos.carnet } },
  "stylos-personnalises": { gallery: [photos.stylos], previews: { FRONT: photos.stylos } },
  "etiquettes-sceaux": { gallery: [photos.etiquettes], previews: { FRONT: photos.etiquettes } },
  photocall: {
    gallery: [photos.photocallEvent, photos.photocallFichier],
    previews: { FULL: photos.photocallFichier, FRONT: photos.photocallFichier },
  },
  "kit-entreprise": { gallery: [photos.kit], previews: { FRONT: photos.kit, CHEST_LEFT: photos.kit } },
};

const printAreas = printAreasJson as Record<string, Partial<Record<Placement, PrintArea>>>;

/* ---------- Products added in customizer v2: photos + print areas come from new-products-media.json ---------- */

interface ManifestPhoto {
  file: string;
  alt: string;
  width: number;
  height: number;
  blank?: string;
}
type ManifestArea =
  | { cx: number; cy: number; w: number; h: number; rot: number; patch: string | null; curve?: { phi: number; arch: number }; masks?: PrintArea["masks"] }
  | { quad: number[][]; aspect: number; patch?: string | null; curve?: { phi: number; arch: number } };
interface ManifestProduct {
  gallery?: ManifestPhoto[];
  previews?: Partial<Record<Placement, string>>;
  /** Color keyword (matched case/accent-insensitively against the selected color) → photo file per placement. */
  colorPreviews?: Record<string, Partial<Record<Placement, string>>>;
  areas?: Record<string, Partial<Record<Placement, ManifestArea>>>;
  frame?: { aspect: number };
  approxPlacements?: Placement[];
  /** Merge into the hand-written entry of the same slug instead of replacing it. */
  merge?: boolean;
}

const frames: Record<string, number> = {};

/** Turns a manifest area into a PrintArea; `quad` areas get an equivalent box (cx, cy, w, h, rot) for the generic code. */
export function normalizeArea(a: ManifestArea, photoW: number, photoH: number): PrintArea {
  if ("quad" in a && a.quad?.length === 4) {
    const q = a.quad.map(([x, y]) => [x, y]) as [[number, number], [number, number], [number, number], [number, number]];
    const k = photoH / photoW; // y fractions → width units
    const b = quadBox(q.map(([x, y]) => [x, y * k]) as Quad, a.aspect);
    return { cx: b.cx, cy: b.cy / k, w: b.w, h: b.h, rot: b.rot, patch: a.patch ?? null, curve: a.curve, quad: q, aspect: a.aspect };
  }
  return a as PrintArea;
}

function registerManifest(products: Record<string, ManifestProduct>) {
  for (const [slug, m] of Object.entries(products)) {
    const toPhoto = (mp: ManifestPhoto): Photo => p(mp.file, mp.alt, mp.width, mp.height, mp.blank);
    const gallery = (m.gallery ?? []).map(toPhoto);
    const byFile = new Map(gallery.map((g) => [fileOf(g), g]));
    const existing = media[slug];
    // the previous hand-written t-shirt entry only reused the polo photos: real t-shirt photos always replace it
    const merge = Boolean(m.merge && existing && slug !== "t-shirt-personnalise");
    if (merge) for (const g of existing.gallery) if (!byFile.has(fileOf(g))) byFile.set(fileOf(g), g);
    if (gallery.length) {
      const previews: Partial<Record<Placement, Photo>> = {};
      for (const [pl, file] of Object.entries(m.previews ?? {})) {
        const ph = byFile.get(file);
        if (ph) previews[pl as Placement] = ph;
      }
      let colorPreviews: ProductMedia["colorPreviews"];
      for (const [key, byPl] of Object.entries(m.colorPreviews ?? {})) {
        colorPreviews ??= {};
        const row: Partial<Record<Placement, Photo>> = {};
        for (const [pl, file] of Object.entries(byPl)) {
          const ph = byFile.get(file);
          if (ph) row[pl as Placement] = ph;
        }
        colorPreviews[key] = row;
      }
      if (merge) {
        media[slug] = {
          gallery: [...existing.gallery, ...gallery.filter((g) => !existing.gallery.some((e) => fileOf(e) === fileOf(g)))],
          previews: { ...existing.previews, ...previews },
          colorPreviews: { ...(existing.colorPreviews ?? {}), ...(colorPreviews ?? {}) },
          approx: [...new Set([...(existing.approx ?? []), ...(m.approxPlacements ?? [])])],
        };
      } else {
        media[slug] = { gallery, previews, colorPreviews, approx: m.approxPlacements };
      }
    }
    for (const [file, areas] of Object.entries(m.areas ?? {})) {
      const dims = byFile.get(file) ?? { width: 1000, height: 1000 };
      const norm: Partial<Record<Placement, PrintArea>> = {};
      for (const [pl, a] of Object.entries(areas)) if (a) norm[pl as Placement] = normalizeArea(a, dims.width, dims.height);
      printAreas[file] = { ...(printAreas[file] ?? {}), ...norm };
    }
    if (m.frame?.aspect) frames[slug] = m.frame.aspect;
  }
}
// The manifest is a map slug → media (optionally wrapped in `{ products }`).
const manifestJson = newMediaJson as unknown as Record<string, ManifestProduct> & { products?: Record<string, ManifestProduct> };
registerManifest(manifestJson.products ?? manifestJson);

/** Aspect ratios (width / height) of the plain print-area frame for products without photography. */
Object.assign(frames, {
  "roll-up": 0.425,
  "tente-pliante-3x3": 1,
  "ballon-personnalise": 0.8,
  "banderole-pvc": 2.5,
  photocall: 1.33,
  "drapeau-plume": 0.3,
  autocollants: 1,
  "flyers-brochures": 0.707,
  "sac-tote": 0.85,
  "sac-a-cordon": 0.85,
  parapluie: 1,
  "gourde-isotherme": 0.5,
  "gobelet-isotherme": 0.6,
  "cle-usb": 1.8,
  "porte-cles": 1.4,
  "protege-passeport": 0.72,
  tablier: 0.8,
  "ballon-football": 1,
  "coque-telephone": 0.62,
  "gourde-aluminium": 0.4,
  "gobelet-cafe": 0.65,
  "badge-lanyard": 0.65,
  ...frames,
});

function fileOf(photo: Photo) {
  return photo.src.split("/").pop() ?? "";
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Gallery photos for a product: local brand photography first, then images provided by the API. */
export function productPhotos(product: Pick<Product, "slug" | "name" | "images">): Photo[] {
  const local = media[product.slug]?.gallery ?? [];
  if (local.length) return local;
  return (product.images ?? [])
    .map((img) => (typeof img === "string" ? { url: img, alt: undefined } : img))
    // Local photography (media[] / new-products-media.json) is canonical; API image paths are only trusted when absolute,
    // so catalog entries whose photo does not exist yet fall back to the « Photo à venir » tile instead of a broken image.
    .filter((img) => /^https?:\/\//.test(img?.url ?? ""))
    .map((img) => ({ src: img.url, alt: img.alt ?? product.name, width: 1200, height: 1200 }));
}

export function primaryPhoto(product: Pick<Product, "slug" | "name" | "images">): Photo | null {
  return productPhotos(product)[0] ?? null;
}

export interface Preview {
  photo: Photo;
  area: PrintArea;
  /** The zone has no dedicated photo: the preview only shows where the design goes. */
  indicative: boolean;
}

/** Neutral print-area frame (no photography): the whole frame is the print area. */
function plainPreview(slug: string, placement: Placement): Preview {
  const aspect = frames[slug] ?? 1;
  const width = 1000;
  const height = Math.round(width / aspect);
  const photo: Photo = { src: "", alt: `Zone d'impression : ${placementLabels[placement] ?? placement}`, width, height, plain: true };
  return { photo, area: { cx: 0.5, cy: 0.5, w: 0.9, h: 0.9 / aspect, rot: 0, patch: "#ffffff" }, indicative: true };
}

/**
 * Photo + print area for a product / zone / color. Zones without a dedicated photo fall back to the base photo and
 * its main print area (flagged `indicative`); products without any photo get a plain print-area frame.
 */
export function previewFor(slug: string, placement: Placement, color?: string): Preview {
  const m = media[slug];
  if (!m) return plainPreview(slug, placement);
  let dedicated: Photo | undefined;
  let fallback: Photo | undefined = m.gallery[0];
  const byColor = color && m.colorPreviews ? Object.entries(m.colorPreviews).find(([k]) => normalize(color).includes(k))?.[1] : undefined;
  if (byColor) {
    dedicated = byColor[placement];
    fallback = byColor.FRONT ?? Object.values(byColor)[0] ?? fallback;
  } else {
    dedicated = m.previews[placement];
  }
  const photo = dedicated ?? fallback;
  if (!photo) return plainPreview(slug, placement);
  const areas = printAreas[fileOf(photo)] ?? {};
  const own = areas[placement];
  const area = own ?? areas.FRONT ?? Object.values(areas)[0] ?? plainPreview(slug, placement).area;
  return { photo, area, indicative: !dedicated || !own || Boolean(m.approx?.includes(placement)) };
}
