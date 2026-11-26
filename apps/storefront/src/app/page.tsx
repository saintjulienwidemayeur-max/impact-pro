import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  Coffee,
  CreditCard,
  Flag,
  Gift,
  LayoutGrid,
  Medal,
  Palette,
  RectangleHorizontal,
  Shirt,
  Timer,
  Truck,
  Upload,
  MousePointerClick,
  PackageCheck,
  type LucideIcon,
  HardHat,
  Mail,
} from "lucide-react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard } from "@/components/product-card";
import { navCategories, type NavCategorySlug } from "@/config/navigation";
import { photos } from "@/config/product-media";
import { listProducts, type Product } from "@/lib/api";
import { site } from "@/lib/site";
import { formatHTG } from "@/lib/utils";

export const revalidate = 60;

/** Service strip: line icons (UI), 8 main categories. */
const stripSlugs: NavCategorySlug[] = ["tasses", "t-shirts-polos", "casquettes", "banderoles", "drapeaux-plume", "cartes-papeterie", "carnets", "photocall"];
const categories = navCategories.filter((c) => stripSlugs.includes(c.slug));

const categoryIcons: Partial<Record<NavCategorySlug, LucideIcon>> = {
  tasses: Coffee,
  "t-shirts-polos": Shirt,
  casquettes: HardHat,
  banderoles: RectangleHorizontal,
  "drapeaux-plume": Flag,
  "cartes-papeterie": CreditCard,
  carnets: BookOpen,
  photocall: Camera,
};

const heroBadges = [
  { icon: Medal, title: "Qualité premium", text: "Impression haute définition" },
  { icon: Truck, title: "Livraison rapide", text: "À temps, à chaque fois" },
  { icon: BadgeCheck, title: "Meilleurs prix", text: "Tarifs dégressifs" },
];

const perks = [
  { icon: Palette, title: "Design gratuit", text: "Nos designers préparent votre maquette" },
  { icon: Truck, title: "Livraison gratuite", text: `Dès ${formatHTG(site.freeShippingThresholdHTG)} d'achat` },
  { icon: BadgeCheck, title: "Qualité 100 %", text: "Chaque pièce est contrôlée" },
  { icon: Timer, title: "Livraison à temps", text: "Nous respectons vos délais" },
];

const steps = [
  { icon: MousePointerClick, title: "Choisissez", text: "Sélectionnez vos articles et quantités." },
  { icon: Upload, title: "Envoyez votre logo", text: "Téléversez votre fichier ou décrivez votre idée." },
  { icon: Check, title: "Validez la maquette", text: "Recevez un aperçu et approuvez-le." },
  { icon: PackageCheck, title: "On imprime & on livre", text: "Production contrôlée, livraison à votre porte." },
];

const reasons = [
  "Techniques modernes : sérigraphie, broderie, sublimation",
  "Matériaux de qualité supérieure",
  "Prix compétitifs et dégressifs",
  "Délais de production rapides",
  "Un conseiller dédié pour chaque commande",
  "Satisfaction client garantie",
];

function Arcs({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 600 600" aria-hidden="true">
      <circle cx="300" cy="300" r="260" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="70" />
      <circle cx="300" cy="300" r="140" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="40" />
    </svg>
  );
}

export default async function HomePage() {
  let popular: Product[] | null = null;
  try {
    const all = await listProducts();
    const discounted = all.filter((p) => p.compareAtPrice);
    popular = [...discounted, ...all.filter((p) => !p.compareAtPrice)].slice(0, 6);
  } catch {
    popular = null;
  }

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ip-teal text-white">
        <Arcs className="pointer-events-none absolute -right-40 -top-24 h-[720px] w-[720px]" />
        <Arcs className="pointer-events-none absolute -bottom-72 -left-56 h-[520px] w-[520px]" />
        <div className="container-ip relative grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <h1 className="font-heading font-bold uppercase leading-[0.95] tracking-tight">
              <span className="block text-3xl sm:text-4xl lg:text-5xl">Nous mettons</span>
              <span className="block text-4xl text-ip-cyan sm:text-5xl lg:text-6xl">votre marque</span>
              <span className="mt-1 block text-5xl text-ip-sun sm:text-6xl lg:text-7xl">sur tout.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/90 sm:text-lg">
              Tasses, t-shirts, casquettes, banderoles, cartes de visite et bien plus : des articles promotionnels de qualité pour les
              entreprises, les événements et les associations en Haïti.
            </p>
            <ul className="mt-7 grid gap-4 sm:grid-cols-3">
              {heroBadges.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10">
                    <Icon className="size-5 text-ip-sun" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-xs font-bold uppercase tracking-wide">{title}</span>
                    <span className="block text-xs text-white/75">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/personnaliser"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 text-sm font-bold uppercase tracking-wide text-ip-ink hover:bg-ip-sun-600"
              >
                Commander <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/devis"
                className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-white/80 px-6 text-sm font-bold uppercase tracking-wide text-white hover:bg-white hover:text-ip-teal"
              >
                Obtenir un devis
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative grid grid-cols-[1.35fr_1fr] gap-3 sm:gap-4">
              <div className="relative row-span-2 overflow-hidden rounded-[1.5rem] bg-white shadow-offset">
                <Image
                  src={photos.kit.src}
                  alt={photos.kit.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 30vw, 55vw"
                  className="object-contain p-2"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-white">
                <Image src={photos.tasses.src} alt={photos.tasses.alt} fill priority sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-white">
                <Image src={photos.casquette.src} alt={photos.casquette.alt} fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" />
              </div>
              <div className="relative col-span-2 aspect-[16/7] overflow-hidden rounded-[1.25rem] bg-black">
                <Image src={photos.poloTeal.src} alt={photos.poloTeal.alt} fill sizes="(min-width: 1024px) 45vw, 95vw" className="object-cover" />
              </div>
            </div>
            <Link
              href="/offres"
              className="absolute -top-4 right-0 flex size-28 rotate-6 flex-col items-center justify-center rounded-full border-4 border-ip-teal bg-ip-sun text-center font-heading text-ip-ink shadow-lg ring-4 ring-ip-sun/40 transition-transform hover:rotate-0 sm:size-32 lg:-right-4"
            >
              <span className="text-xs font-semibold uppercase">Jusqu&apos;à</span>
              <span className="text-3xl font-bold leading-none sm:text-4xl">30 %</span>
              <span className="text-xs font-semibold uppercase">de rabais</span>
            </Link>
          </div>
        </div>
      </section>

      {/* SERVICES STRIP */}
      <section aria-labelledby="services-title" className="relative z-10 -mt-8">
        <div className="container-ip">
          <div className="rounded-[1.5rem] border border-ip-line bg-white p-3 shadow-xl sm:p-4">
            <h2 id="services-title" className="sr-only">
              Nos services
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              {categories.map((c) => {
                const Icon = categoryIcons[c.slug] ?? LayoutGrid;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/produits?categorie=${c.slug}`}
                      className="flex h-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-ip-mist"
                    >
                      <span className="inline-flex size-14 items-center justify-center rounded-full border border-ip-line bg-ip-mist text-ip-teal">
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold uppercase leading-tight tracking-wide">{c.name}</span>
                      <span className="text-[11px] leading-tight text-ip-muted">{c.tagline}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="col-span-2 sm:col-span-3 md:col-span-5 lg:col-span-1">
                <Link
                  href="/personnaliser"
                  className="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-ip-teal p-3 text-center text-white hover:bg-ip-teal-600"
                >
                  <LayoutGrid className="size-6" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wide">Voir tous les services</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* POPULAR PRODUCTS */}
      <section aria-labelledby="popular-title" className="py-16">
        <div className="container-ip">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="popular-title" className="text-2xl font-bold uppercase text-ip-ink sm:text-3xl">
                Produits populaires
              </h2>
              <span className="mt-2 block h-1 w-14 rounded bg-ip-sun" aria-hidden="true" />
            </div>
            <Link href="/produits" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-ip-teal hover:underline sm:text-sm">
              Tous les produits <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {popular === null ? (
            <ApiUnavailable compact />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
              {popular.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CORPORATE KITS */}
      <section aria-labelledby="kits-title" className="pb-16">
        <div className="container-ip">
          <div className="grid items-center gap-8 overflow-hidden rounded-[1.5rem] border border-ip-line bg-white p-5 sm:p-8 lg:grid-cols-2 lg:gap-12">
            <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-white">
              <Image src={photos.kit.src} alt={photos.kit.alt} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ip-teal">Kits d&apos;entreprise</p>
              <h2 id="kits-title" className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">
                Votre logo sur tout votre kit
              </h2>
              <span className="mt-3 block h-1 w-14 rounded bg-ip-sun" aria-hidden="true" />
              <p className="mt-4 text-ip-muted">
                Parapluie, polo, sac, gourde, casquette, clé USB, porte-clés… Composez un kit cohérent pour vos équipes, vos clients ou vos
                événements : un seul interlocuteur, une seule maquette, une livraison groupée.
              </p>
              <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                {["Accueil des nouveaux employés", "Cadeaux clients & partenaires", "Séminaires et conférences", "Lancements de produits"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ip-teal text-white">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/personnaliser/kit-entreprise"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-6 text-sm font-bold uppercase tracking-wide text-ip-ink hover:bg-ip-sun-600"
                >
                  Composer mon kit <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/devis"
                  className="inline-flex h-12 items-center rounded-xl border-2 border-ip-teal px-6 text-sm font-bold uppercase tracking-wide text-ip-teal hover:bg-ip-teal hover:text-white"
                >
                  Devis sur mesure
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SPECIAL OFFER BAND */}
      <section aria-labelledby="offer-title" className="pb-16">
        <div className="container-ip">
          <div className="grid gap-6 overflow-hidden rounded-[1.5rem] bg-ip-ink p-6 text-white sm:p-8 lg:grid-cols-[1.1fr_3fr] lg:items-center">
            <div className="flex items-center gap-4">
              <Gift className="size-12 shrink-0 text-ip-sun" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Offre spéciale</p>
                <h2 id="offer-title" className="text-2xl font-bold leading-tight">
                  Jusqu&apos;à <span className="text-ip-sun">30 %</span> sur une sélection
                </h2>
                <Link
                  href="/offres"
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-ip-sun px-3 text-xs font-bold uppercase tracking-wide text-ip-ink hover:bg-ip-sun-600"
                >
                  Voir les offres <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:border-l lg:border-white/15 lg:pl-6">
              {perks.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-8 shrink-0 text-ip-cyan" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-bold uppercase tracking-wide">{title}</span>
                    <span className="block text-sm text-white/75">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS + WHY US */}
      <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-28 bg-ip-mist py-16">
        <div className="container-ip grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 id="how-title" className="text-2xl font-bold uppercase sm:text-3xl">
              Comment ça marche
            </h2>
            <span className="mt-2 block h-1 w-14 rounded bg-ip-sun" aria-hidden="true" />
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {steps.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative flex flex-col items-center text-center">
                  <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-ip-teal font-heading text-2xl font-bold text-white shadow-offset">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="absolute left-[calc(50%+44px)] top-8 hidden h-0 w-[calc(100%-88px)] border-t-2 border-dashed border-ip-teal/40 xl:block" aria-hidden="true" />
                  )}
                  <Icon className="mt-4 size-5 text-ip-teal" aria-hidden="true" />
                  <h3 className="mt-2 text-sm font-bold uppercase tracking-wide">{title}</h3>
                  <p className="mt-1 text-sm text-ip-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-ip-line bg-white p-7">
            <h2 className="text-xl font-bold uppercase">Pourquoi nous choisir ?</h2>
            <ul className="mt-5 space-y-3">
              {reasons.map((r) => (
                <li key={r} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ip-teal text-white">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            <div className="pointer-events-none absolute -bottom-10 -right-10 size-36 rounded-full bg-ip-cyan/20" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-4 right-16 size-16 rounded-full bg-ip-sun/40" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section aria-labelledby="newsletter-title" className="py-16">
        <div className="container-ip">
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-[1.5rem] bg-ip-teal p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <Arcs className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px]" />
            <div className="relative flex items-center gap-4">
              <Mail className="size-10 shrink-0 text-ip-sun" aria-hidden="true" />
              <div>
                <h2 id="newsletter-title" className="text-xl font-bold uppercase sm:text-2xl">
                  Restez informé de nos offres
                </h2>
                <p className="text-sm text-white/85">Inscrivez-vous et ne manquez plus aucune promotion.</p>
              </div>
            </div>
            <div className="relative lg:w-[480px]">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
