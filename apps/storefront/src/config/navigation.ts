/**
 * Category navigation (information architecture). Slugs match the API's catalog categories;
 * product data itself always comes from the API.
 */
export const navCategories = [
  { slug: "tasses", name: "Tasses", tagline: "Céramique 11 oz, sublimation" },
  { slug: "t-shirts-polos", name: "T-shirts & polos", tagline: "Sérigraphie ou broderie" },
  { slug: "casquettes", name: "Casquettes", tagline: "Logo brodé, réglables" },
  { slug: "banderoles", name: "Banderoles", tagline: "PVC extérieur, œillets" },
  { slug: "drapeaux-plume", name: "Drapeaux plume", tagline: "Visibles de loin" },
  { slug: "cartes-papeterie", name: "Cartes & papeterie", tagline: "Cartes de visite, en-têtes" },
  { slug: "carnets", name: "Carnets", tagline: "A5, logo sérigraphié" },
  { slug: "stylos", name: "Stylos", tagline: "Tampographie" },
  { slug: "etiquettes-sceaux", name: "Étiquettes & sceaux", tagline: "Colis et emballages" },
  { slug: "photocall", name: "Photocall", tagline: "Panneaux d'événement" },
] as const;

export type NavCategorySlug = (typeof navCategories)[number]["slug"];
