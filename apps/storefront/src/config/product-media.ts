/**
 * Product photography (from the Impact Pro brand book and promo kit) and live-preview print areas.
 * This is presentation config, not catalog data: names, prices and options come from the API.
 */
import type { Placement, Product } from "@/lib/api";
import printAreasJson from "./print-areas.json";

export interface PrintArea {
  /** Center, as a fraction of the photo width / height. */
  cx: number;
  cy: number;
  /** Box size, both as a fraction of the photo WIDTH (keeps aspect when the box is rotated). */
  w: number;
  h: number;
  rot: number;
  /** Surface color used to mask the sample logo already printed on the photo (null = no mask). */
  patch: string | null;
}

export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const p = (file: string, alt: string, width: number, height: number): Photo => ({ src: `/photos/${file}`, alt, width, height });

export const photos = {
  tasse: p("tasse-11oz.jpg", "Tasse céramique blanche 11 oz avec logo imprimé", 1400, 1620),
  tasses: p("tasses-serie.jpg", "Deux tasses blanches personnalisées, icône et logo", 1400, 966),
  poloBlanc: p("polo-blanc-brode.jpg", "Polo blanc avec logo brodé côté cœur", 1255, 1737),
  poloTeal: p("polo-equipe-teal.jpg", "Polo d'équipe teal, vue devant et dos avec logo", 1400, 855),
  casquette: p("casquette-brodee.jpg", "Casquette blanche avec logo brodé en façade", 1400, 1268),
  banderole: p("banderole-pvc.jpg", "Banderole PVC extérieure 3 × 1,2 m installée avec œillets", 1400, 1295),
  drapeaux: p("drapeaux-plume.jpg", "Trois drapeaux plume blanc, teal et jaune", 1400, 942),
  carteRecto: p("carte-visite-recto.jpg", "Carte de visite recto, fond teal avec logo", 1400, 793),
  carteVerso: p("carte-visite-verso.jpg", "Carte de visite verso avec coordonnées et icône", 1400, 794),
  entete: p("papier-entete.jpg", "Papier à en-tête A4 avec logo et coordonnées", 1250, 1768),
  carnet: p("carnet-a5.jpg", "Carnet A5 teal avec logo en sérigraphie", 1238, 1506),
  stylos: p("stylos.jpg", "Stylos blancs marqués en tampographie", 1094, 1506),
  etiquettes: p("etiquettes-sceaux.jpg", "Étiquettes rondes « Merci ! » et sceau avec icône", 1008, 469),
  photocallEvent: p("photocall-evenement.jpg", "Photocall installé lors d'un événement, motif step & repeat", 1400, 1295),
  photocallFichier: p("photocall-fichier.jpg", "Fichier d'impression du photocall 3 × 2,25 m", 1400, 1050),
  kit: p("kit-promotionnel.jpg", "Kit promotionnel : parapluie, polo, sac, gourde, casquette, clé USB et porte-clés avec logo", 736, 736),
  reseaux: p("couverture-reseaux.jpg", "Couverture réseaux sociaux Impact Pro", 1400, 492),
} satisfies Record<string, Photo>;

export interface ProductMedia {
  gallery: Photo[];
  /** Which photo previews each placement. */
  previews: Partial<Record<Placement, Photo>>;
  /** Overrides by color keyword (matched case/accent-insensitively against the selected color). */
  colorPreviews?: Record<string, Partial<Record<Placement, Photo>>>;
}

const media: Record<string, ProductMedia> = {
  "tasse-ceramique-11oz": {
    gallery: [photos.tasse, photos.tasses],
    previews: { FRONT: photos.tasse, WRAP: photos.tasse },
  },
  "polo-brode": {
    gallery: [photos.poloBlanc, photos.poloTeal],
    previews: { CHEST_LEFT: photos.poloBlanc, FRONT: photos.poloBlanc, BACK: photos.poloTeal, SLEEVE: photos.poloTeal },
    colorPreviews: { teal: { CHEST_LEFT: photos.poloTeal, FRONT: photos.poloTeal, BACK: photos.poloTeal, SLEEVE: photos.poloTeal } },
  },
  "t-shirt-personnalise": {
    gallery: [photos.poloTeal, photos.poloBlanc],
    previews: { FRONT: photos.poloTeal, BACK: photos.poloTeal, CHEST_LEFT: photos.poloTeal, SLEEVE: photos.poloTeal },
    colorPreviews: { blanc: { FRONT: photos.poloBlanc, CHEST_LEFT: photos.poloBlanc } },
  },
  "casquette-brodee": { gallery: [photos.casquette], previews: { FRONT: photos.casquette } },
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
    .filter((img) => img?.url?.startsWith("/photos/"))
    .map((img) => ({ src: img.url, alt: img.alt ?? product.name, width: 1200, height: 1200 }));
}

export function primaryPhoto(product: Pick<Product, "slug" | "name" | "images">): Photo | null {
  return productPhotos(product)[0] ?? null;
}

/** Photo + print area for a product/placement/color, falling back to any photo that has an area for the placement. */
export function previewFor(slug: string, placement: Placement, color?: string): { photo: Photo; area: PrintArea | null } | null {
  const m = media[slug];
  if (!m) return null;
  let photo: Photo | undefined;
  if (color && m.colorPreviews) {
    const c = normalize(color);
    const key = Object.keys(m.colorPreviews).find((k) => c.includes(k));
    if (key) photo = m.colorPreviews[key][placement];
  }
  photo ??= m.previews[placement] ?? m.gallery[0];
  if (!photo) return null;
  const areas = printAreas[fileOf(photo)] ?? {};
  const area = areas[placement] ?? areas.FRONT ?? Object.values(areas)[0] ?? null;
  return { photo, area };
}
