/**
 * DEV SEED CATALOG — development/demo data only.
 *
 * This typed, in-memory catalog lets the storefront render real, navigable pages
 * before the backend exists. It MUST be replaced by the API catalog
 * (`GET /api/v1/catalog/products`, `GET /api/v1/catalog/categories`) in Phase 3.
 * Prices are indicative placeholders in HTG, not commercial offers.
 */

export type VisualKind =
  | "mug"
  | "tshirt"
  | "polo"
  | "cap"
  | "banner"
  | "flag"
  | "card"
  | "notebook"
  | "pen"
  | "photocall"
  | "sticker";

export type CategorySlug =
  | "tasses"
  | "t-shirts-polos"
  | "casquettes"
  | "banderoles"
  | "drapeaux-plume"
  | "cartes-de-visite"
  | "carnets-stylos"
  | "photocall";

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
}

export interface Product {
  slug: string;
  name: string;
  category: CategorySlug;
  shortDescription: string;
  description: string;
  priceHTG: number;
  oldPriceHTG?: number;
  unit: string;
  minQuantity: number;
  technique: string;
  visual: VisualKind;
  /** Base color of the illustrated item. */
  tone: "white" | "teal" | "cyan" | "sun";
  features: string[];
  popular?: boolean;
}

export const categories: Category[] = [
  { slug: "tasses", name: "Tasses", tagline: "Céramique 11 oz, sublimation" },
  { slug: "t-shirts-polos", name: "T-shirts & polos", tagline: "Sérigraphie ou broderie" },
  { slug: "casquettes", name: "Casquettes", tagline: "Logo brodé, réglables" },
  { slug: "banderoles", name: "Banderoles", tagline: "PVC extérieur, œillets" },
  { slug: "drapeaux-plume", name: "Drapeaux plume", tagline: "Visibles de loin" },
  { slug: "cartes-de-visite", name: "Cartes de visite", tagline: "Cartes & papeterie" },
  { slug: "carnets-stylos", name: "Carnets & stylos", tagline: "Cadeaux d'affaires" },
  { slug: "photocall", name: "Photocall", tagline: "Panneaux d'événement" },
];

export const products: Product[] = [
  {
    slug: "tasse-ceramique-11-oz",
    name: "Tasse céramique 11 oz",
    category: "tasses",
    shortDescription: "Impression sublimation pleine couleur",
    description:
      "Tasse blanche en céramique de 11 oz, imprimée en sublimation pour un rendu net et résistant au lave-vaisselle. Idéale pour les cadeaux clients et les équipes.",
    priceHTG: 650,
    oldPriceHTG: 900,
    unit: "pièce",
    minQuantity: 12,
    technique: "Sublimation",
    visual: "mug",
    tone: "white",
    features: ["Céramique 11 oz", "Impression recto ou tour complet", "Compatible lave-vaisselle"],
    popular: true,
  },
  {
    slug: "polo-equipe-brode",
    name: "Polo d'équipe brodé",
    category: "t-shirts-polos",
    shortDescription: "Logo brodé cœur + dos imprimé",
    description:
      "Polo piqué 100 % coton, disponible en teal, blanc et autres coloris. Logo brodé côté cœur, option texte ou logo au dos pour vos uniformes.",
    priceHTG: 1450,
    oldPriceHTG: 1950,
    unit: "pièce",
    minQuantity: 10,
    technique: "Broderie",
    visual: "polo",
    tone: "teal",
    features: ["Coton piqué 220 g/m²", "Tailles S à 3XL", "Broderie jusqu'à 8 couleurs"],
    popular: true,
  },
  {
    slug: "t-shirt-coton-personnalise",
    name: "T-shirt coton personnalisé",
    category: "t-shirts-polos",
    shortDescription: "Sérigraphie 1 à 4 couleurs",
    description:
      "T-shirt col rond en coton peigné, imprimé en sérigraphie. Parfait pour les événements, campagnes et associations.",
    priceHTG: 950,
    oldPriceHTG: 1300,
    unit: "pièce",
    minQuantity: 20,
    technique: "Sérigraphie",
    visual: "tshirt",
    tone: "cyan",
    features: ["Coton peigné 180 g/m²", "Impression avant et/ou dos", "Nombreux coloris"],
  },
  {
    slug: "casquette-brodee",
    name: "Casquette brodée",
    category: "casquettes",
    shortDescription: "Coton brossé, fermeture réglable",
    description:
      "Casquette 6 panneaux en coton brossé, logo brodé en façade. Fermeture réglable pour s'adapter à tous.",
    priceHTG: 850,
    oldPriceHTG: 1200,
    unit: "pièce",
    minQuantity: 12,
    technique: "Broderie",
    visual: "cap",
    tone: "white",
    features: ["6 panneaux", "Broderie 3D possible", "Taille unique réglable"],
    popular: true,
  },
  {
    slug: "banderole-pvc-3x1-2",
    name: "Banderole PVC 3 × 1,2 m",
    category: "banderoles",
    shortDescription: "PVC extérieur avec œillets",
    description:
      "Banderole en PVC 440 g résistante aux intempéries, avec ourlets et œillets tous les 50 cm. Idéale pour façades, stands et événements.",
    priceHTG: 8500,
    oldPriceHTG: 11500,
    unit: "banderole",
    minQuantity: 1,
    technique: "Impression grand format",
    visual: "banner",
    tone: "white",
    features: ["PVC 440 g", "Encres résistantes UV", "Œillets inclus"],
    popular: true,
  },
  {
    slug: "drapeau-plume",
    name: "Drapeau plume",
    category: "drapeaux-plume",
    shortDescription: "Mât + pied inclus, 3 coloris",
    description:
      "Drapeau plume imprimé recto, livré avec mât et pied. Disponible en blanc, teal ou jaune soleil pour être vu de loin.",
    priceHTG: 14500,
    oldPriceHTG: 19000,
    unit: "kit",
    minQuantity: 1,
    technique: "Impression grand format",
    visual: "flag",
    tone: "sun",
    features: ["Hauteur 3 m", "Mât aluminium + pied", "Tissu polyester 110 g"],
  },
  {
    slug: "cartes-de-visite-recto-verso",
    name: "Cartes de visite recto/verso",
    category: "cartes-de-visite",
    shortDescription: "Lot de 100 · 3,5 × 2 po",
    description:
      "Cartes de visite 3,5 × 2 po imprimées recto/verso sur papier 350 g, finition mate ou brillante.",
    priceHTG: 1800,
    oldPriceHTG: 2500,
    unit: "lot de 100",
    minQuantity: 1,
    technique: "Impression numérique",
    visual: "card",
    tone: "teal",
    features: ["Papier 350 g", "Finition mate ou brillante", "Livraison rapide"],
    popular: true,
  },
  {
    slug: "etiquettes-sceaux",
    name: "Étiquettes & sceaux",
    category: "cartes-de-visite",
    shortDescription: "Autocollants ronds · lot de 100",
    description: "Autocollants ronds pour colis, emballages et cadeaux. « Merci ! » ou votre logo.",
    priceHTG: 1500,
    oldPriceHTG: 2000,
    unit: "lot de 100",
    minQuantity: 1,
    technique: "Impression numérique",
    visual: "sticker",
    tone: "sun",
    features: ["Vinyle adhésif", "Diamètre 5 cm", "Découpe ronde"],
  },
  {
    slug: "carnet-a5",
    name: "Carnet A5",
    category: "carnets-stylos",
    shortDescription: "Couverture souple, logo sérigraphié",
    description: "Carnet A5 à couverture similicuir avec élastique, marque-page et porte-stylo. Logo en sérigraphie.",
    priceHTG: 1100,
    oldPriceHTG: 1450,
    unit: "pièce",
    minQuantity: 10,
    technique: "Sérigraphie",
    visual: "notebook",
    tone: "teal",
    features: ["192 pages lignées", "Élastique + marque-page", "Porte-stylo"],
    popular: true,
  },
  {
    slug: "stylo-personnalise",
    name: "Stylo personnalisé",
    category: "carnets-stylos",
    shortDescription: "Tampographie 1 couleur",
    description: "Stylo bille blanc à encre bleue, marquage en tampographie sur le corps ou l'agrafe.",
    priceHTG: 125,
    oldPriceHTG: 175,
    unit: "pièce",
    minQuantity: 100,
    technique: "Tampographie",
    visual: "pen",
    tone: "white",
    features: ["Encre bleue", "Marquage 1 couleur", "Mécanisme rotatif"],
  },
  {
    slug: "photocall-3x2-25",
    name: "Photocall 3 × 2,25 m",
    category: "photocall",
    shortDescription: "Motif « step & repeat »",
    description:
      "Mur photocall avec structure pliable et bâche imprimée en motif « step & repeat », pour que chaque photo montre votre marque.",
    priceHTG: 32000,
    oldPriceHTG: 42000,
    unit: "kit",
    minQuantity: 1,
    technique: "Impression grand format",
    visual: "photocall",
    tone: "white",
    features: ["Structure pliable", "Bâche 3 × 2,25 m", "Sac de transport"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function searchProducts({ q, categorie }: { q?: string; categorie?: string }): Product[] {
  const query = q ? normalize(q.trim()) : "";
  return products.filter((p) => {
    if (categorie && p.category !== categorie) return false;
    if (!query) return true;
    const haystack = normalize(`${p.name} ${p.shortDescription} ${p.technique} ${getCategory(p.category)?.name ?? ""}`);
    return query.split(/\s+/).every((term) => haystack.includes(term));
  });
}

export const popularProducts = products.filter((p) => p.popular).slice(0, 6);
