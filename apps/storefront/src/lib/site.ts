/** Site-wide configuration. Contact values are placeholders until Impact Pro provides final details. */
export const site = {
  name: "Impact Pro",
  legalName: "Impact Pro LLC",
  tagline: "Votre marque, partout.",
  description:
    "Impact Pro personnalise vos articles promotionnels en Haïti : tasses, t-shirts, polos, casquettes, banderoles, drapeaux, cartes de visite et photocalls à votre image.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  phoneDisplay: "+509 [XXXX-XXXX]",
  email: "contact@impactpro.ht",
  address: "Port-au-Prince, Haïti",
  hours: "Lun – Sam : 8 h 00 – 17 h 00",
  freeShippingThresholdHTG: 10000,
} as const;

/** WhatsApp deep link when a number is configured, otherwise the contact page (never a dead link). */
export function whatsappHref(message = "Bonjour Impact Pro, j'aimerais un devis."): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return "/contact";
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export const socialLinks = [
  { label: "Facebook", href: process.env.NEXT_PUBLIC_FACEBOOK_URL, icon: "facebook" as const },
  { label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL, icon: "instagram" as const },
].filter((s): s is { label: string; href: string; icon: "facebook" | "instagram" } => Boolean(s.href));

export const services = [
  { id: "serigraphie", name: "Sérigraphie", description: "Couleurs vives et durables sur textile, sacs et carnets." },
  { id: "broderie", name: "Broderie", description: "Un rendu haut de gamme pour polos, casquettes et uniformes." },
  { id: "sublimation", name: "Sublimation", description: "Impression photo-qualité sur tasses et textiles polyester." },
  { id: "tampographie", name: "Tampographie", description: "Marquage précis sur stylos et petits objets." },
  { id: "grand-format", name: "Impression grand format", description: "Banderoles PVC, drapeaux plume et photocalls." },
  { id: "design", name: "Création graphique", description: "Nos designers préparent ou ajustent votre logo gratuitement." },
] as const;

export const mainNav = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "/a-propos" },
  { label: "Services", href: "/personnaliser", menu: "services" as const },
  { label: "Produits", href: "/produits", menu: "products" as const },
  { label: "Personnaliser", href: "/personnaliser" },
  { label: "Offres", href: "/offres" },
  { label: "Contact", href: "/contact" },
];
