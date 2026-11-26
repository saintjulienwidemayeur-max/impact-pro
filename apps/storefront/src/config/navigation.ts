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
  { slug: "kits", name: "Kits d'entreprise", tagline: "Votre logo sur tout le kit" },
] as const;

export type NavCategorySlug = (typeof navCategories)[number]["slug"];

/**
 * Customizable product families added with the studio. They link straight to the customizer of a catalog product
 * (slug = API product slug), so the destination always exists once the catalog is seeded.
 */
export const navFamilies = [
  { slug: "ballon-football", name: "Ballons de foot", tagline: "Votre logo sur le ballon" },
  { slug: "ballon-personnalise", name: "Ballons de fête", tagline: "Latex imprimé, 1 ou 2 faces" },
  { slug: "t-shirt-personnalise", name: "T-shirts", tagline: "Devant, dos, plusieurs couleurs" },
  { slug: "tente-pliante-3x3", name: "Tentes pliantes", tagline: "Toit et côtés imprimés" },
  { slug: "roll-up", name: "Roll-up", tagline: "Votre fichier, 85 × 200 cm" },
  { slug: "sac-tote", name: "Sacs tote", tagline: "Devant et dos" },
  { slug: "sac-a-cordon", name: "Sacs à cordon", tagline: "Logo + texte" },
  { slug: "parapluie", name: "Parapluies", tagline: "Toile imprimée" },
  { slug: "gourde-aluminium", name: "Gourdes aluminium", tagline: "Logo et texte" },
  { slug: "gourde-isotherme", name: "Gourdes isothermes", tagline: "Logo et texte" },
  { slug: "gobelet-cafe", name: "Gobelets café", tagline: "Couvercle blanc ou noir" },
  { slug: "gobelet-isotherme", name: "Gobelets isothermes", tagline: "Logo et texte" },
  { slug: "coque-telephone", name: "Coques téléphone", tagline: "Choisissez votre modèle" },
  { slug: "badge-lanyard", name: "Badges & lanyards", tagline: "Événements et équipes" },
  { slug: "cle-usb", name: "Clés USB", tagline: "Votre logo gravé" },
  { slug: "porte-cles", name: "Porte-clés", tagline: "Devant et dos" },
  { slug: "flyers-brochures", name: "Flyers & brochures", tagline: "Importez votre fichier" },
  { slug: "autocollants", name: "Autocollants", tagline: "Stickers sur mesure" },
] as const;
