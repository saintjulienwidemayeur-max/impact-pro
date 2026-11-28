import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Layers,
  Mail,
  Megaphone,
  MessagesSquare,
  Mic,
  Paintbrush,
  Plus,
  Search,
  ShieldCheck,
  Sparkle,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { CategoryStage } from "@/components/category-stage";
import { Cutout } from "@/components/cutout";
import { ServiceSelector } from "@/components/service-selector";
import { eventOccasions, eventServices, moreServices, promoCategories, quoteHref, sourcingSteps } from "@/config/offer";
import { categoryIcons } from "@/config/offer-icons";

export const revalidate = 3600;

function Caption({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <span className={`absolute bottom-3 z-10 inline-flex h-7 items-center gap-1.5 rounded-full bg-ip-ink/85 px-3 text-xs font-semibold text-white backdrop-blur ${right ? "right-3" : "left-3"}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ip-sun" />
      {children}
    </span>
  );
}

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] ${light ? "text-ip-cyan" : "text-ip-teal"}`}>
      <span aria-hidden="true" className="h-0.5 w-[18px] rounded bg-current" />
      {children}
    </span>
  );
}

function SectionHead({ eyebrow, title, id, children, light }: { eyebrow: string; title: string; id: string; children?: React.ReactNode; light?: boolean }) {
  return (
    <div className="mb-10 flex flex-col gap-5 lg:mb-11 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
      <div>
        <Eyebrow light={light}>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-3.5 max-w-[680px] text-[34px] font-semibold leading-[1.08] tracking-[-0.015em] sm:text-[44px]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

const tapeA = ["Giveaways", "Cadeaux corporate", "Articles de carnaval", "Achats & sourcing", "Événements", "Conseil & médias"];
const tapeB = ["Événements", "Conseil & médias", "Sourcing de produits", "Impression grand format", "Textile & uniformes", "Signalétique"];

function Tape({ words, className, iconClass }: { words: string[]; className: string; iconClass: string }) {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-7 pr-7">
      {words.map((w) => (
        <span key={w + key} className="flex items-center gap-7">
          {w}
          <Sparkle className={`size-4 fill-current ${iconClass}`} aria-hidden="true" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`absolute -inset-x-10 flex h-14 items-center overflow-hidden whitespace-nowrap font-heading text-xl font-semibold sm:h-16 sm:text-[25px] ${className}`}>
      <div className="flex animate-[ip-marquee_45s_linear_infinite]">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

const studioShelf = [
  { slug: "t-shirt-personnalise", name: "T-shirt", img: "/photos/showcase/t-shirt-personnalise.webp" },
  { slug: "gobelet-cafe", name: "Gobelet", img: "/photos/showcase/gobelet-cafe.webp" },
  { slug: "sac-tote", name: "Sac tote", img: "/photos/showcase/sac-tote.webp" },
  { slug: "tente-pliante-3x3", name: "Tente 3×3", img: "/photos/showcase/tente-pliante-3x3.webp" },
  { slug: "roll-up", name: "Roll-up", img: "/photos/showcase/roll-up.webp" },
];

const eventIcons: LucideIcon[] = [CalendarDays, Megaphone, MessagesSquare, Mic];

const steps = [
  { icon: MessagesSquare, title: "Votre demande", text: "Décrivez votre besoin en ligne ou personnalisez un article dans le studio." },
  { icon: Mail, title: "Proforma & maquette", text: "Vous recevez une proforma détaillée et, si besoin, une maquette sous 24 h." },
  { icon: ShieldCheck, title: "Réalisation", text: "Production, achat ou organisation, avec contrôle qualité et suivi." },
  { icon: Truck, title: "Livraison", text: "Livraison suivie de Miami vers Haïti, ou installation sur le lieu de l'événement." },
];

export default function HomePage() {
  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-ip-deep pb-32 pt-14 text-white sm:pt-16 lg:pb-36 lg:pt-[72px]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-52 -top-64 size-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(10,113,106,0.75),rgba(10,61,57,0))]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-[420px] -top-[520px] size-[1100px] rounded-full border border-white/[0.07]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-64 -top-[350px] size-[760px] rounded-full border border-white/[0.07]" />
        <div className="container-ip relative grid items-center gap-12 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-14">
          <div>
            <p className="inline-flex h-[34px] items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] pl-1.5 pr-3.5 text-[13px] font-semibold">
              <span className="rounded-full bg-ip-sun px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-ip-ink">ONE-STOP SHOP</span>
              Un seul partenaire pour tous vos projets
            </p>
            <h1 id="hero-title" className="mt-6 text-[40px] font-semibold leading-[1.06] tracking-[-0.015em] sm:text-[52px] xl:text-[58px]">
              Promouvoir, équiper et{" "}
              <span className="relative whitespace-nowrap text-ip-sun">
                faire vivre
                <svg aria-hidden="true" className="absolute -bottom-2.5 left-0 h-4 w-full" viewBox="0 0 300 16" preserveAspectRatio="none">
                  <path d="M3 11C70 4 160 2 297 8" stroke="#42C6F0" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
              </span>{" "}
              votre marque.
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/80 sm:text-lg">
              Articles promotionnels, achats et sourcing de produits, événements et conseil : Impact Pro réunit tout ce qu&apos;il faut à votre marque, que vous soyez une petite entreprise ou un grand groupe.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={quoteHref()} className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink shadow-[0_8px_24px_-10px_rgba(255,201,60,0.8)] hover:bg-ip-sun-600">
                Demander une proforma <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Link>
              <Link href="#nos-metiers" className="inline-flex h-[50px] items-center justify-center rounded-xl border-[1.5px] border-white/35 px-6 font-bold hover:bg-white/10">
                Découvrir nos services
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[0.12] pt-7 text-[13.5px] font-medium text-white/85">
              {[
                { icon: Layers, text: "Petites et grandes quantités" },
                { icon: Clock, text: "Proforma sous 24 h" },
                { icon: Truck, text: "Miami → Haïti" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <Icon className="size-[22px] text-ip-cyan" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop bento */}
          <div className="relative hidden grid-cols-[1.15fr_1fr_1fr] grid-rows-[232px_232px] gap-3.5 lg:grid">
            <div className="relative row-span-2 overflow-hidden rounded-[20px]">
              <Image src="/photos/photocall-evenement.jpg" alt="Photocall Impact Pro lors d'un événement" fill priority sizes="300px" className="object-cover" />
              <Caption>Événements</Caption>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ip-mist">
              <Cutout src="/photos/tasses-serie.webp" box={[8, 10, 84, 74]} priority />
              <Caption>Giveaways</Caption>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ip-teal">
              <Cutout src="/photos/carnet-a5.webp" box={[14, 12, 52, 72]} />
              <Cutout src="/photos/stylos.webp" box={[56, 16, 34, 64]} />
              <Caption>Cadeaux corporate</Caption>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ip-mist">
              <Cutout src="/photos/polo-equipe-teal.webp" box={[4, 14, 92, 66]} />
              <Caption right>Uniformes</Caption>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ip-sun">
              <Cutout src="/photos/drapeaux-plume.webp" box={[6, 6, 88, 80]} />
              <Caption>Signalétique</Caption>
            </div>
            <Link
              href="/personnaliser"
              className="absolute -bottom-8 -left-9 z-10 flex w-[300px] items-center gap-3 rounded-[18px] bg-white p-3 pr-4 text-ip-ink shadow-[0_2px_4px_rgba(14,42,46,0.06),0_32px_64px_-24px_rgba(10,61,57,0.35)] hover:ring-2 hover:ring-ip-cyan"
            >
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ip-mist">
                <Image src="/photos/showcase/t-shirt-personnalise.webp" alt="" fill sizes="56px" className="object-cover" />
              </span>
              <span>
                <span className="block font-heading text-[15px] font-semibold">Votre logo, en direct</span>
                <span className="text-[12.5px] leading-snug text-ip-muted">Personnalisez et voyez le rendu avant de commander</span>
              </span>
              <span className="absolute right-3.5 top-3 flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide text-emerald-700">
                <span aria-hidden="true" className="size-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(46,204,143,0.18)]" />
                LIVE
              </span>
            </Link>
          </div>

          {/* Mobile strip */}
          <div className="grid h-32 grid-cols-[1.2fr_1fr_1fr] gap-2 sm:h-44 lg:hidden" aria-hidden="true">
            <div className="relative overflow-hidden rounded-2xl">
              <Image src="/photos/photocall-evenement.jpg" alt="" fill sizes="40vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-ip-mist">
              <Cutout src="/photos/tasses-serie.webp" box={[6, 10, 88, 80]} sizes="30vw" />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-ip-sun">
              <Cutout src="/photos/drapeaux-plume.webp" box={[6, 8, 88, 84]} sizes="30vw" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- SELECTOR ---------------- */}
      <section aria-labelledby="selector-title" className="container-ip relative z-10 -mt-24">
        <ServiceSelector />
      </section>

      {/* ---------------- TAPES ---------------- */}
      <div aria-hidden="true" className="relative mt-8 h-36 overflow-hidden sm:h-40">
        <Tape words={tapeB} className="top-12 rotate-[2.2deg] bg-ip-teal text-white/90" iconClass="text-ip-cyan" />
        <Tape words={tapeA} className="top-14 z-10 -rotate-2 bg-ip-sun text-ip-ink shadow-[0_10px_30px_-12px_rgba(14,42,46,0.35)]" iconClass="text-ip-teal" />
      </div>

      {/* ---------------- PILLARS ---------------- */}
      <section id="nos-metiers" aria-labelledby="pillars-title" className="container-ip scroll-mt-28 pb-20 pt-14 lg:pb-24">
        <SectionHead eyebrow="Nos métiers" title="Un seul interlocuteur, tout ce dont votre marque a besoin" id="pillars-title">
          <p className="max-w-[400px] leading-relaxed text-ip-muted">
            Les articles promotionnels sont notre cœur de métier, mais nous allons bien plus loin : sourcing, événements, conseil… et de nouveaux services s&apos;ajoutent régulièrement.
          </p>
        </SectionHead>
        <div className="grid gap-5 lg:grid-cols-[7fr_5fr]">
          <article className="flex flex-col overflow-hidden rounded-3xl border border-ip-line bg-white lg:row-span-2">
            <div className="relative h-64 overflow-hidden bg-gradient-to-b from-[#EAF3F1] to-[#F6FAF9] sm:h-[340px]">
              <span className="absolute left-6 top-6 z-10 inline-flex h-[30px] items-center gap-1.5 rounded-full bg-ip-sun px-3 text-xs font-bold">
                <Sparkle className="size-3.5 fill-current" aria-hidden="true" /> Cœur de métier
              </span>
              <span aria-hidden="true" className="absolute left-1/4 top-[-25%] size-[520px] rounded-full border-[44px] border-ip-teal/[0.06]" />
              <Cutout src="/photos/polo-blanc-brode.webp" box={[3, 15, 28, 78]} sizes="220px" />
              <Cutout src="/photos/casquette-brodee.webp" box={[27, 8, 26, 44]} />
              <Cutout src="/photos/stylos.webp" box={[31, 54, 16, 41]} />
              <Cutout src="/photos/tasse-11oz.webp" box={[49, 34, 23, 58]} />
              <Cutout src="/photos/carnet-a5.webp" box={[69, 11, 19, 53]} />
              <Cutout src="/photos/sac-tote-blanc.webp" box={[82, 43, 14, 50]} />
            </div>
            <div className="p-6 sm:p-8">
              <h3 className="text-3xl font-semibold sm:text-[34px]">Articles promotionnels</h3>
              <p className="mb-5 mt-2.5 max-w-[560px] text-[15.5px] text-ip-muted">
                Des articles à votre image pour fidéliser vos clients, remercier vos partenaires et marquer les esprits lors de vos événements.
              </p>
              <ul>
                {promoCategories.map((c) => {
                  const Icon = categoryIcons[c.slug];
                  return (
                    <li key={c.slug}>
                      <Link href={`/articles-promotionnels/${c.slug}`} className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-t border-ip-line py-3.5">
                        <span className="inline-flex size-12 items-center justify-center rounded-[14px] bg-ip-mist text-ip-teal">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block font-heading text-lg font-semibold group-hover:text-ip-teal">{c.name}</span>
                          <span className="text-[13.5px] text-ip-muted">{c.short}</span>
                        </span>
                        <span className="inline-flex size-[38px] items-center justify-center rounded-full border-[1.5px] border-ip-line text-ip-teal group-hover:border-ip-teal group-hover:bg-ip-teal group-hover:text-white">
                          <ArrowRight className="size-[18px]" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>

          <article className="rounded-3xl bg-ip-deep p-7 text-white sm:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-[14px] bg-ip-cyan/15 text-ip-cyan">
              <Search className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mb-2 mt-[18px] text-[28px] font-semibold leading-tight">Achats &amp; sourcing de produits</h3>
            <p className="text-[14.5px] leading-relaxed text-white/75">
              Un produit précis à trouver, en petite ou grande quantité ? Nous le cherchons, l&apos;achetons, le contrôlons et vous le livrons.
            </p>
            <ol className="relative my-6 grid grid-cols-4 before:absolute before:left-[12%] before:right-[12%] before:top-[15px] before:border-t-2 before:border-dashed before:border-ip-cyan/45">
              {sourcingSteps.map((s, i) => (
                <li key={s.title} className="relative text-center text-[11.5px] font-semibold leading-tight text-white/85">
                  <span
                    className={`mx-auto mb-2 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      i === sourcingSteps.length - 1 ? "border-ip-sun bg-ip-sun text-ip-ink" : "border-ip-cyan bg-ip-deep text-ip-cyan"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {s.title}
                </li>
              ))}
            </ol>
            <Link href="/sourcing" className="inline-flex items-center gap-1.5 font-bold text-ip-sun hover:underline">
              Lancer une recherche <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </article>

          <article className="relative flex min-h-[330px] flex-col justify-end overflow-hidden rounded-3xl bg-ip-ink p-7 text-white sm:p-8">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[52%]">
              <Image src="/photos/photocall-evenement.jpg" alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[center_40%]" />
              <div className="absolute inset-0 bg-gradient-to-b from-ip-ink/0 from-35% to-ip-ink" />
            </div>
            <div className="relative">
              <span className="inline-flex size-12 items-center justify-center rounded-[14px] bg-ip-sun/20 text-ip-sun">
                <CalendarDays className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mb-2 mt-[18px] text-[28px] font-semibold leading-tight">Événements &amp; conseil</h3>
              <p className="text-[14.5px] leading-relaxed text-white/75">Organisation et marketing d&apos;événements, conseil, et services liés aux médias en Haïti.</p>
              <ul className="mb-4 mt-3.5 flex flex-wrap gap-1.5">
                {["Organisation", "Marketing", "Conseil", "Médias"].map((t) => (
                  <li key={t} className="h-7 rounded-full border border-white/30 px-3 text-xs font-semibold leading-[26px]">
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/evenements-conseil" className="inline-flex items-center gap-1.5 font-bold text-ip-sun hover:underline">
                Découvrir <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <div className="flex flex-col gap-4 rounded-3xl border-[1.5px] border-dashed border-[#B9CFCB] p-6 sm:flex-row sm:items-center sm:gap-5 lg:col-span-2">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-ip-sun">
              <Plus className="size-6" strokeWidth={2.4} aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-[19px] font-semibold">Et ce n&apos;est qu&apos;un début.</p>
              <p className="text-sm text-ip-muted">
                De nouveaux services arrivent. Un besoin qui n&apos;est pas listé ?{" "}
                <Link href="/contact" className="font-semibold text-ip-teal hover:underline">
                  Parlez-nous-en
                </Link>
                .
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 sm:ml-auto">
              {moreServices.map((m) => (
                <li key={m.label}>
                  <Link href={m.href} className="inline-flex h-[30px] items-center whitespace-nowrap rounded-full bg-[#E7F0EE] px-3 text-[12.5px] font-semibold text-ip-teal hover:bg-ip-teal hover:text-white">
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------- PROMO CATEGORIES ---------------- */}
      <section aria-labelledby="cats-title" className="bg-ip-mist py-20 lg:py-24">
        <div className="container-ip">
          <SectionHead eyebrow="Articles promotionnels" title="Le bon article, pour chaque occasion" id="cats-title">
            <Link href="/articles-promotionnels" className="inline-flex h-11 items-center gap-2 self-start rounded-xl border-[1.5px] border-ip-line bg-white px-5 text-sm font-bold hover:border-ip-teal hover:text-ip-teal lg:self-auto">
              Toutes les catégories <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </SectionHead>
          <div className="grid gap-5 md:grid-cols-3">
            {promoCategories.map((c) => (
              <article key={c.slug} className="flex flex-col overflow-hidden rounded-3xl border border-ip-line bg-white">
                <div className="relative h-60 sm:h-[290px]">
                  <CategoryStage slug={c.slug} />
                  {c.slug === "evenements-de-masse" && (
                    <span className="absolute bottom-3.5 left-3.5 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold">Visuel provisoire · photos à venir</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ip-teal">{c.kicker}</span>
                  <h3 className="mb-2 mt-2 text-[27px] font-semibold">{c.name}</h3>
                  <p className="text-[14.5px] text-ip-muted">{c.description}</p>
                  <ul className="mb-5 mt-4 flex flex-wrap gap-1.5">
                    {c.examples.map((e) => (
                      <li key={e} className="inline-flex h-[30px] items-center rounded-full bg-[#E7F0EE] px-3 text-[12.5px] font-semibold text-ip-teal">
                        {e}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-ip-line pt-4">
                    <span className="text-[12.5px] text-ip-muted">{c.occasions}</span>
                    <Link href={`/articles-promotionnels/${c.slug}`} className="inline-flex shrink-0 items-center gap-1.5 font-bold text-ip-teal hover:underline" aria-label={`Voir la catégorie ${c.name}`}>
                      Voir <ArrowRight className="size-[18px]" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-7 rounded-3xl border border-ip-line bg-white p-6 sm:p-7 lg:grid-cols-[320px_1fr] lg:items-center">
            <div>
              <Eyebrow>Studio en ligne</Eyebrow>
              <h3 className="mb-2 mt-3 text-[28px] font-semibold leading-tight">Ajoutez votre logo, voyez le rendu tout de suite</h3>
              <p className="mb-5 text-[14.5px] text-ip-muted">Choisissez un article, téléversez votre logo ou votre photo, ajustez-le : la maquette part avec votre demande.</p>
              <Link href="/personnaliser" className="inline-flex h-[50px] items-center gap-2.5 rounded-xl bg-ip-ink px-6 font-bold text-white hover:bg-ip-deep">
                <Paintbrush className="size-5" aria-hidden="true" /> Ouvrir le studio
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {studioShelf.map((p) => (
                <li key={p.slug}>
                  <Link href={`/personnaliser/${p.slug}`} className="group block overflow-hidden rounded-2xl border border-ip-line bg-ip-mist hover:border-ip-teal">
                    <span className="relative block aspect-[4/3.4]">
                      <Image src={p.img} alt="" fill sizes="(min-width: 1024px) 180px, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    </span>
                    <span className="block border-t border-ip-line bg-white px-3 py-2.5">
                      <span className="block font-heading text-[14.5px] font-semibold">{p.name}</span>
                      <span className="text-xs font-bold text-ip-teal">Personnaliser →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------- AUDIENCES ---------------- */}
      <section aria-labelledby="aud-title" className="container-ip py-20 lg:py-24">
        <SectionHead eyebrow="Pour qui" title="Petits ou grands projets, le même soin" id="aud-title">
          <p className="max-w-[400px] leading-relaxed text-ip-muted">
            Que vous commandiez 20 casquettes ou équipiez un événement national, vous avez un interlocuteur et une proforma claire.
          </p>
        </SectionHead>
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            {
              dark: true,
              icon: Building2,
              title: "Grandes entreprises & gros projets",
              text: "Programmes annuels, lancements, événements d'envergure : nous coordonnons tout, du sourcing à la livraison.",
              points: ["Interlocuteur dédié", "Grands volumes", "Proformas & factures entreprise", "Suivi de production et livraison"],
              cta: { label: "Parler à un conseiller", href: "/contact" },
            },
            {
              dark: false,
              icon: Store,
              title: "Petites entreprises & indépendants",
              text: "Une boutique, une association, un projet perso ? Commencez petit, en ligne, et faites grandir votre marque avec nous.",
              points: ["Petites quantités", "Studio en ligne avec aperçu", "Proforma rapide sous 24 h", "Carte, Zelle ou virement"],
              cta: { label: "Personnaliser un article", href: "/personnaliser" },
            },
          ].map((a) => (
            <article
              key={a.title}
              className={`relative flex min-h-[400px] flex-col overflow-hidden rounded-3xl p-8 sm:p-10 ${a.dark ? "bg-ip-deep text-white" : "bg-[#EAF7FC] text-ip-ink"}`}
            >
              {a.dark && <span aria-hidden="true" className="absolute -bottom-52 -right-36 size-[460px] rounded-full border-[56px] border-white/[0.04]" />}
              <span className={`relative inline-flex size-14 items-center justify-center rounded-2xl ${a.dark ? "bg-ip-sun text-ip-ink" : "bg-ip-cyan text-ip-ink"}`}>
                <a.icon className="size-[26px]" aria-hidden="true" />
              </span>
              <h3 className="relative mb-2.5 mt-5 max-w-[420px] text-[30px] font-semibold leading-tight sm:text-[34px]">{a.title}</h3>
              <p className={`relative max-w-[470px] leading-relaxed ${a.dark ? "text-white/75" : "text-[#3E5B58]"}`}>{a.text}</p>
              <ul className="relative mb-8 mt-6 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[14.5px] font-semibold leading-snug">
                    <Check className={`mt-px size-5 shrink-0 ${a.dark ? "text-ip-sun" : "text-ip-teal"}`} strokeWidth={2.6} aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href={a.cta.href}
                className={`relative mt-auto inline-flex h-[50px] items-center gap-2.5 self-start rounded-xl px-6 font-bold ${
                  a.dark ? "bg-ip-sun text-ip-ink hover:bg-ip-sun-600" : "bg-ip-teal text-white hover:bg-ip-teal-600"
                }`}
              >
                {a.cta.label} <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- EVENTS ---------------- */}
      <section aria-labelledby="events-title" className="bg-ip-ink py-20 text-white lg:py-24">
        <div className="container-ip grid items-center gap-12 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-16">
          <div className="grid h-[380px] grid-cols-[1.25fr_1fr] grid-rows-[1.2fr_1fr] gap-3.5 sm:h-[454px]">
            <div className="relative row-span-2 overflow-hidden rounded-[20px]">
              <Image src="/photos/photocall-evenement.jpg" alt="Photocall aux couleurs Impact Pro" fill sizes="(min-width: 1024px) 320px, 55vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ip-sun">
              <Cutout src="/photos/drapeaux-plume.webp" box={[6, 6, 88, 88]} sizes="240px" />
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-[#F6F8F8]">
              <Cutout src="/photos/tente-stand-complet.webp" box={[6, 6, 88, 88]} sizes="240px" />
            </div>
          </div>
          <div>
            <Eyebrow light>Événements &amp; conseil</Eyebrow>
            <h2 id="events-title" className="mb-4 mt-3.5 text-[34px] font-semibold leading-[1.08] sm:text-[44px]">
              Vos événements, de l&apos;idée au dernier invité
            </h2>
            <p className="max-w-[560px] text-[16.5px] leading-relaxed text-white/70">
              Nous imaginons, organisons et faisons connaître vos événements, et vous conseillons sur votre communication et vos relations avec les médias en Haïti.
            </p>
            <ul className="my-7 grid gap-3 sm:grid-cols-2">
              {eventServices.map((s, i) => {
                const Icon = eventIcons[i] ?? CalendarDays;
                return (
                  <li key={s.title} className="rounded-[18px] border border-white/10 bg-white/5 p-[18px]">
                    <Icon className="size-6 text-ip-sun" aria-hidden="true" />
                    <p className="mb-1 mt-3 font-heading text-[17px] font-semibold">{s.title}</p>
                    <p className="text-[13px] leading-snug text-white/65">{s.text}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mb-7 flex flex-wrap items-center gap-2 text-[13px] text-white/65">
              Pour :
              {eventOccasions.slice(0, 4).map((o) => (
                <span key={o} className="h-[30px] rounded-full bg-ip-cyan/15 px-3 text-[12.5px] font-semibold leading-[30px] text-ip-cyan">
                  {o}
                </span>
              ))}
            </p>
            <Link href={quoteHref("evenement")} className="inline-flex h-[50px] items-center gap-2.5 rounded-xl bg-ip-sun px-6 font-bold text-ip-ink hover:bg-ip-sun-600">
              Parler de mon événement <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- PROCESS ---------------- */}
      <section id="comment-ca-marche" aria-labelledby="how-title" className="container-ip scroll-mt-28 py-20 lg:py-24">
        <SectionHead eyebrow="Comment ça marche" title="Simple, du premier message à la livraison" id="how-title">
          <p className="max-w-[400px] leading-relaxed text-ip-muted">Le même processus clair, quel que soit le service ou la taille de votre projet.</p>
        </SectionHead>
        <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:before:absolute lg:before:left-7 lg:before:right-[calc((100%-72px)/4-28px)] lg:before:top-7 lg:before:h-0.5 lg:before:bg-gradient-to-r lg:before:from-ip-teal lg:before:to-ip-cyan">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <span
                className={`relative inline-flex size-14 items-center justify-center rounded-full border-2 ${
                  i === steps.length - 1 ? "border-ip-sun bg-ip-sun text-ip-ink" : "border-ip-teal bg-white text-ip-teal"
                }`}
              >
                <s.icon className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xs font-bold tracking-[0.12em] text-ip-teal">ÉTAPE 0{i + 1}</p>
              <h3 className="mb-2 mt-1.5 text-[22px] font-semibold">{s.title}</h3>
              <p className="max-w-[270px] text-[14.5px] leading-relaxed text-ip-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section aria-labelledby="cta-title" className="relative overflow-hidden bg-ip-teal py-20 text-white lg:py-24">
        <span aria-hidden="true" className="absolute -left-64 -top-72 size-[700px] rounded-full border-[64px] border-white/5" />
        <span aria-hidden="true" className="absolute -bottom-96 right-1/3 size-[520px] rounded-full border-[64px] border-ip-cyan/10" />
        <div className="container-ip relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Eyebrow light>Parlons-en</Eyebrow>
            <h2 id="cta-title" className="mt-3.5 max-w-[640px] text-[36px] font-semibold leading-[1.05] sm:text-[50px]">
              Un projet en tête, petit ou grand ?
            </h2>
            <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/80">
              Articles, sourcing, événement ou conseil : dites-nous ce qu&apos;il vous faut. Un membre de l&apos;équipe vous répond avec une proforma sous 24 h ouvrées.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto">
            <Link href={quoteHref()} className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-ip-sun px-8 text-lg font-bold text-ip-ink shadow-[10px_10px_0_0_var(--color-ip-cyan)] hover:bg-ip-sun-600">
              Demander une proforma <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-xl border-[1.5px] border-white/35 px-6 font-bold hover:bg-white/10">
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
