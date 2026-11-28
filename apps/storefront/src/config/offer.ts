/**
 * Impact Pro's offer: a one-stop shop. Promotional items are the core business (three categories), plus
 * purchasing & product sourcing and event marketing & consulting. More services will be added: append them here,
 * the header, footer, homepage and quote form read from this file.
 *
 * Sub-category lists and service descriptions are drafts to be confirmed by the owner.
 */

export type ServiceId = "articles" | "sourcing" | "evenement" | "conseil";

/** Services offered in the quote form and the homepage selector. */
export const quoteServices: { id: ServiceId; label: string; hint: string }[] = [
  { id: "articles", label: "Articles promotionnels", hint: "Giveaways, cadeaux, carnaval" },
  { id: "sourcing", label: "Achat & sourcing", hint: "Trouver et acheter un produit" },
  { id: "evenement", label: "Événement", hint: "Organisation & marketing" },
  { id: "conseil", label: "Conseil & médias", hint: "Stratégie, relations médias" },
];

export type ProjectSize = "petit" | "moyen" | "grand";
export const projectSizes: { id: ProjectSize; label: string; long: string }[] = [
  { id: "petit", label: "< 100", long: "Moins de 100 pièces" },
  { id: "moyen", label: "100 – 1 000", long: "De 100 à 1 000 pièces" },
  { id: "grand", label: "1 000 +", long: "Plus de 1 000 pièces" },
];

export const serviceLabel = (id: string | undefined): string | undefined => quoteServices.find((s) => s.id === id)?.label;
export const sizeLabel = (id: string | undefined): string | undefined => projectSizes.find((s) => s.id === id)?.long;

/** Link to the quote form with the service (and optionally the project size) preselected. */
export function quoteHref(service?: ServiceId, size?: ProjectSize): string {
  const q = new URLSearchParams();
  if (service) q.set("service", service);
  if (size) q.set("taille", size);
  const s = q.toString();
  return s ? `/devis?${s}` : "/devis";
}

export type PromoCategorySlug = "giveaways" | "cadeaux-corporate" | "evenements-de-masse";

export type PromoCategory = {
  slug: PromoCategorySlug;
  name: string;
  kicker: string;
  short: string;
  description: string;
  occasions: string;
  /** Sub-categories shown in the mega menu and on the category page. */
  groups: string[];
  /** Example chips on cards. */
  examples: string[];
  /** Catalog products (API slugs) shown on the category page; hidden/missing products are skipped. */
  productSlugs: string[];
  badge?: string;
};

export const promoCategories: PromoCategory[] = [
  {
    slug: "giveaways",
    name: "Giveaways",
    kicker: "Visibilité maximale",
    short: "Petits articles à distribuer en nombre",
    description: "Des articles utiles, distribués en grand nombre, pour que votre logo circule partout : salons, promotions, rentrée, campagnes.",
    occasions: "Salons, promotions, rentrée, campagnes",
    groups: ["Stylos & écriture", "Tasses & gobelets", "Sacs & tote bags", "Badges & lanyards", "Ballons & sport", "Gourdes & bouteilles"],
    examples: ["Stylos", "Tasses", "Sacs", "Ballons", "Gourdes"],
    productSlugs: ["stylos-personnalises", "tasse-ceramique-11oz", "gobelet-cafe", "sac-tote", "ballon-football", "ballon-personnalise", "gourde-aluminium", "badge-lanyard", "autocollants"],
  },
  {
    slug: "cadeaux-corporate",
    name: "Cadeaux corporate",
    kicker: "Image haut de gamme",
    short: "Pour vos clients, partenaires et équipes",
    description: "Coffrets et articles soignés pour remercier vos clients, vos partenaires et vos collaborateurs, et accueillir vos nouvelles recrues.",
    occasions: "Fin d'année, partenaires, accueil des équipes",
    groups: ["Coffrets cadeaux", "Carnets & papeterie", "Polos & textile brodé", "Kits d'accueil", "Accessoires"],
    examples: ["Coffrets", "Carnets", "Polos brodés", "Kits d'accueil"],
    productSlugs: ["kit-entreprise", "carnet-a5", "polo-brode", "casquette-brodee", "gourde-aluminium", "cartes-de-visite", "papier-en-tete", "coque-telephone"],
    badge: "Sur mesure",
  },
  {
    slug: "evenements-de-masse",
    name: "Événements de masse",
    kicker: "Grandes séries",
    short: "Carnaval, festivals, concerts : bandanas, mouchoirs, bracelets…",
    description: "Carnaval, festivals, concerts, campagnes : des milliers d'articles produits et livrés dans les délais pour habiller la foule à vos couleurs.",
    occasions: "Carnaval, festivals, concerts, campagnes",
    groups: ["Bandanas & mouchoirs", "Bracelets", "T-shirts & casquettes", "Drapeaux & banderoles", "Tentes & roll-ups"],
    examples: ["Bandanas", "Mouchoirs", "Bracelets", "T-shirts", "Casquettes"],
    productSlugs: ["t-shirt-personnalise", "casquette-brodee", "drapeau-plume", "banderole-pvc", "tente-pliante-3x3", "roll-up", "photocall", "flyers-brochures"],
    badge: "Carnaval",
  },
];

export const promoCategory = (slug: string): PromoCategory | undefined => promoCategories.find((c) => c.slug === slug);

export const eventServices = [
  { title: "Organisation d'événements", text: "Planification, logistique, habillage et installation sur place." },
  { title: "Marketing événementiel", text: "Visibilité, activations de marque et supports de campagne." },
  { title: "Conseil & consulting", text: "Stratégie de marque et de communication, adaptée à votre budget." },
  { title: "Médias en Haïti", text: "Relations et services liés aux médias pour faire connaître votre projet." },
] as const;

export const eventOccasions = ["Carnaval", "Lancements", "Conférences", "Festivals", "Inaugurations"] as const;

export const sourcingSteps = [
  { title: "Votre besoin", text: "Le produit, la quantité, le budget et le délai." },
  { title: "Recherche fournisseurs", text: "Nous identifions et comparons les fournisseurs." },
  { title: "Achat & contrôle qualité", text: "Nous achetons et vérifions la marchandise." },
  { title: "Livraison", text: "Expédition suivie, de Miami vers Haïti." },
] as const;

/** Other services, shown as chips ("et bien plus"). They link to existing pages only. */
export const moreServices = [
  { label: "Impression grand format", href: "/produits?categorie=banderoles" },
  { label: "Textile & uniformes", href: "/produits?categorie=t-shirts-polos" },
  { label: "Papeterie d'entreprise", href: "/produits?categorie=cartes-papeterie" },
];
