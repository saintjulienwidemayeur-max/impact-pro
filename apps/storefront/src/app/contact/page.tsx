import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/page-header";
import { SocialIcon } from "@/components/social-icons";
import { site, whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Impact Pro pour vos articles promotionnels personnalisés en Haïti.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const wa = whatsappHref();
  const waConfigured = wa.startsWith("http");
  return (
    <>
      <PageHeader title="Contactez-nous" intro="Une question, un projet ? Écrivez-nous, nous répondons vite." crumbs={[{ label: "Contact" }]} />
      <div className="container-ip grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[1.5rem] border border-ip-line p-5 sm:p-8">
          <h2 className="mb-5 text-2xl font-semibold">Envoyer un message</h2>
          <ContactForm />
        </div>
        <aside className="space-y-4">
          <div className="rounded-[1.5rem] bg-ip-teal p-6 text-white shadow-offset">
            <h2 className="text-xl font-semibold">Impact Pro</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="size-4 shrink-0 text-ip-cyan" aria-hidden="true" /> {site.address}
              </li>
              <li className="flex gap-2.5">
                <Phone className="size-4 shrink-0 text-ip-cyan" aria-hidden="true" /> {site.phoneDisplay}
              </li>
              <li className="flex gap-2.5">
                <Mail className="size-4 shrink-0 text-ip-cyan" aria-hidden="true" />
                <a href={`mailto:${site.email}`} className="underline-offset-2 hover:underline">
                  {site.email}
                </a>
              </li>
              <li className="flex gap-2.5">
                <Clock className="size-4 shrink-0 text-ip-cyan" aria-hidden="true" /> {site.hours}
              </li>
            </ul>
          </div>
          {waConfigured && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-ip-teal font-semibold text-white hover:bg-ip-teal-600"
            >
              <SocialIcon name="whatsapp" className="size-5" /> Écrivez-nous sur WhatsApp
            </a>
          )}
        </aside>
      </div>
    </>
  );
}
