import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, MessagesSquare, Mic, type LucideIcon } from "lucide-react";
import { Cutout } from "@/components/cutout";
import { GhostLink, PrimaryLink, ServiceHero } from "@/components/service-hero";
import { eventOccasions, eventServices, quoteHref, type ServiceId } from "@/config/offer";

export const metadata: Metadata = {
  title: "Événements & conseil",
  description: "Organisation et marketing d'événements, conseil en communication et services liés aux médias en Haïti. Impact Pro, votre guichet unique.",
  alternates: { canonical: "/evenements-conseil" },
};

const icons: LucideIcon[] = [CalendarDays, Megaphone, MessagesSquare, Mic];
const serviceFor: ServiceId[] = ["evenement", "evenement", "conseil", "conseil"];

export default function EventsPage() {
  return (
    <>
      <ServiceHero
        eyebrow="Événements & conseil"
        title="Vos événements, de l'idée au dernier invité"
        intro="Nous imaginons, organisons et faisons connaître vos événements, et vous conseillons sur votre communication et vos relations avec les médias en Haïti."
        crumbs={[{ label: "Événements & conseil" }]}
        aside={
          <div className="relative hidden h-[340px] overflow-hidden rounded-3xl lg:block">
            <Image src="/photos/photocall-evenement.jpg" alt="Photocall aux couleurs Impact Pro" fill priority sizes="600px" className="object-cover" />
          </div>
        }
      >
        <PrimaryLink href={quoteHref("evenement")}>
          Parler de mon événement <ArrowRight className="size-[18px]" aria-hidden="true" />
        </PrimaryLink>
        <GhostLink href={quoteHref("conseil")}>Demander un conseil</GhostLink>
      </ServiceHero>

      <section aria-labelledby="svc-title" className="container-ip py-14 lg:py-20">
        <h2 id="svc-title" className="text-3xl font-semibold sm:text-4xl">
          Ce que nous faisons pour vous
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {eventServices.map((s, i) => {
            const Icon = icons[i] ?? CalendarDays;
            return (
              <li key={s.title} className="flex flex-col rounded-3xl border border-ip-line bg-white p-7">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-ip-mist text-ip-teal">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-2xl font-semibold">{s.title}</h3>
                <p className="mt-1 text-ip-muted">{s.text}</p>
                <Link href={quoteHref(serviceFor[i])} className="mt-5 inline-flex items-center gap-1.5 font-bold text-ip-teal hover:underline">
                  En parler <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="kit-title" className="bg-ip-ink py-14 text-white lg:py-20">
        <div className="container-ip grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 id="kit-title" className="text-3xl font-semibold sm:text-4xl">
              Tout le matériel, aux couleurs de votre marque
            </h2>
            <p className="mt-3 text-white/70">
              Photocalls, tentes, drapeaux, roll-ups, banderoles, tenues d&apos;équipe et articles à distribuer : nous produisons et installons l&apos;habillage de votre événement.
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/65">
              Pour :
              {eventOccasions.map((o) => (
                <span key={o} className="h-[30px] rounded-full bg-ip-cyan/15 px-3 text-[12.5px] font-semibold leading-[30px] text-ip-cyan">
                  {o}
                </span>
              ))}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/articles-promotionnels/evenements-de-masse" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ip-sun px-5 font-bold text-ip-ink hover:bg-ip-sun-600">
                Articles pour événements <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/produits?categorie=photocall" className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-white/35 px-5 font-bold hover:bg-white/10">
                Photocalls &amp; affichage
              </Link>
            </div>
          </div>
          <div className="grid h-[340px] grid-cols-2 gap-3.5">
            <div className="relative overflow-hidden rounded-[20px] bg-ip-sun">
              <Cutout src="/photos/drapeaux-plume.webp" box={[6, 6, 88, 88]} sizes="300px" />
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-[#F6F8F8]">
              <Cutout src="/photos/tente-stand-complet.webp" box={[6, 6, 88, 88]} sizes="300px" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
