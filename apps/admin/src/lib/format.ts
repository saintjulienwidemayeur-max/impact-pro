import type { DocumentStatus, DocumentType, OrderStatus, PaymentMethod } from "./types";

const nf = () => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cache = new Map<string, Intl.NumberFormat>();

/** « 12 500,00 HTG » — amounts are strings with 2 decimals from the API. */
export function money(amount: string | number | null | undefined, currency = "HTG"): string {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0);
  let f = cache.get(currency);
  if (!f) {
    f = nf();
    cache.set(currency, f);
  }
  return `${f.format(Number.isFinite(n) ? n : 0)} ${currency}`.replace(/ /g, " ").replace(/ /g, " ");
}

export function dateFr(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
export const dateInput = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "");
export const today = (): string => new Date().toISOString().slice(0, 10);

export type Tone = "gray" | "teal" | "cyan" | "sun" | "red" | "green" | "ink";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  RECEIVED: { label: "Reçue", tone: "cyan" },
  MOCKUP_SENT: { label: "Maquette envoyée", tone: "sun" },
  APPROVED: { label: "Approuvée", tone: "teal" },
  IN_PRODUCTION: { label: "En production", tone: "teal" },
  READY: { label: "Prête", tone: "green" },
  DELIVERED: { label: "Livrée", tone: "green" },
  CANCELLED: { label: "Annulée", tone: "red" },
};

export const DOC_STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "gray" },
  SENT: { label: "Envoyé", tone: "cyan" },
  ACCEPTED: { label: "Accepté", tone: "green" },
  REJECTED: { label: "Refusé", tone: "red" },
  EXPIRED: { label: "Expiré", tone: "sun" },
  PARTIALLY_PAID: { label: "Payé en partie", tone: "sun" },
  PAID: { label: "Payé", tone: "green" },
  VOID: { label: "Annulé", tone: "red" },
};

export const DOC_TYPE: Record<DocumentType, { label: string; plural: string; path: string; short: string }> = {
  QUOTE: { label: "Devis", plural: "Devis", path: "/devis", short: "DEV" },
  PROFORMA: { label: "Facture proforma", plural: "Proformas", path: "/proformas", short: "PRO" },
  INVOICE: { label: "Facture", plural: "Factures", path: "/factures", short: "FAC" },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Espèces" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
  { value: "ZELLE", label: "Zelle" },
  { value: "CARD", label: "Carte" },
  { value: "CHECK", label: "Chèque" },
  { value: "OTHER", label: "Autre" },
];
export const methodLabel = (m: string): string => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

export const PLACEMENT_LABELS: Record<string, string> = {
  FRONT: "Devant",
  BACK: "Dos",
  CHEST_LEFT: "Cœur",
  SLEEVE: "Manche",
  WRAP: "Tour complet",
  FULL: "Pleine surface",
  SIDE: "Côté",
  TOP: "Dessus",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "auth.login_failed": "Échec de connexion",
  "auth.login_blocked": "Connexion bloquée",
  "auth.password_change": "Mot de passe changé",
  "admin.bootstrap": "Premier administrateur créé",
  "order.status_change": "Statut de commande",
  "order.note": "Note de commande",
  "customer.create": "Client créé",
  "customer.update": "Client modifié",
  "product.create": "Produit créé",
  "product.update": "Produit modifié",
  "document.create": "Document créé",
  "document.update": "Document modifié",
  "document.send": "Document envoyé",
  "document.convert": "Document converti",
  "document.duplicate": "Document dupliqué",
  "document.delete": "Brouillon supprimé",
  "document.void": "Document annulé",
  "document.accept.public": "Accepté par le client",
  "payment.record": "Paiement enregistré",
  "payment.void": "Paiement annulé",
  "billing.settings.update": "Paramètres de facturation",
  "staff.create": "Utilisateur créé",
  "staff.update": "Utilisateur modifié",
  "staff.reset_password": "Mot de passe réinitialisé",
};

export const QUOTE_REQUEST_STATUS: Record<import("./types").QuoteRequestStatus, { label: string; tone: Tone }> = {
  NEW: { label: "Nouvelle", tone: "sun" },
  IN_PROGRESS: { label: "En cours", tone: "cyan" },
  PROFORMA_SENT: { label: "Proforma envoyée", tone: "teal" },
  WON: { label: "Gagnée", tone: "green" },
  LOST: { label: "Perdue", tone: "gray" },
};

export const QUOTE_SERVICE: Record<import("./types").QuoteRequestService, string> = {
  ARTICLES: "Articles promotionnels",
  SOURCING: "Achat & sourcing",
  EVENT: "Événement",
  CONSULTING: "Conseil & médias",
};

export const PROJECT_SIZE: Record<string, string> = { petit: "< 100 pièces", moyen: "100 – 1 000 pièces", grand: "1 000 + pièces" };
