import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { navCategories as categories } from "@/config/navigation";
import { site, socialLinks, whatsappHref } from "@/lib/site";
import { SocialIcon } from "./social-icons";

const quickLinks = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "/a-propos" },
  { label: "Produits", href: "/produits" },
  { label: "Personnaliser", href: "/personnaliser" },
  { label: "Offres", href: "/offres" },
  { label: "Contact", href: "/contact" },
];

const customerLinks = [
  { label: "Demander un devis", href: "/devis" },
  { label: "Mon panier", href: "/panier" },
  { label: "Espace client", href: "/compte" },
  { label: "Créer un compte", href: "/inscription" },
  { label: "Suivre une commande", href: "/suivi" },
  { label: "Comment ça marche", href: "/#comment-ca-marche" },
  { label: "Nous écrire", href: "/contact" },
];

const payments = ["MonCash", "NatCash", "Visa", "Mastercard"];

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ip-sun">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-white/80 hover:text-white hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const wa = whatsappHref();
  const waExternal = wa.startsWith("http");
  return (
    <footer className="bg-ip-deep text-white">
      <div className="container-ip grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
        <div className="col-span-2 lg:col-span-1">
          <Image src="/brand/logo-impact-pro-inverse.png" alt="Impact Pro" width={1116} height={349} className="h-12 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-white/80">
            Votre partenaire en articles promotionnels personnalisés. Tasses, textiles, banderoles, cartes et photocalls — on met votre marque partout.
          </p>
          <div className="mt-5 flex gap-2">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-ip-cyan hover:text-ip-ink"
              >
                <SocialIcon name={s.icon} className="size-4" />
              </a>
            ))}
            <a
              href={wa}
              {...(waExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label="Écrivez-nous sur WhatsApp"
              className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-ip-cyan hover:text-ip-ink"
            >
              <SocialIcon name="whatsapp" className="size-4" />
            </a>
          </div>
        </div>
        <FooterCol title="Liens rapides" links={quickLinks} />
        <FooterCol title="Nos services" links={categories.map((c) => ({ label: c.name, href: `/produits?categorie=${c.slug}` }))} />
        <FooterCol title="Service client" links={customerLinks} />
        <div className="col-span-2 sm:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ip-sun">Contact</h2>
          <ul className="space-y-3 text-sm text-white/85">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ip-cyan" aria-hidden="true" />
              {site.address}
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-ip-cyan" aria-hidden="true" />
              {site.phoneDisplay}
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-ip-cyan" aria-hidden="true" />
              <a href={`mailto:${site.email}`} className="hover:underline">
                {site.email}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-ip-cyan" aria-hidden="true" />
              {site.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-ip flex flex-col items-center justify-between gap-4 py-5 text-sm text-white/70 md:flex-row">
          <p>© {new Date().getFullYear()} {site.legalName}. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1">Paiements acceptés :</span>
            {payments.map((p) => (
              <span key={p} className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-ip-ink">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="brand-stripe h-1.5" />
    </footer>
  );
}
