"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, CalendarDays, Check, Gift, MessagesSquare, Search, type LucideIcon } from "lucide-react";
import { projectSizes, quoteHref, quoteServices, type ProjectSize, type ServiceId } from "@/config/offer";
import { cn } from "@/lib/utils";

const icons: Record<ServiceId, LucideIcon> = { articles: Gift, sourcing: Search, evenement: CalendarDays, conseil: MessagesSquare };

/** "Que souhaitez-vous réaliser ?" — picks a service and a project size, then opens the quote form prefilled. */
export function ServiceSelector() {
  const [service, setService] = React.useState<ServiceId>("articles");
  const [size, setSize] = React.useState<ProjectSize>("moyen");

  return (
    <div
      data-testid="service-selector"
      className="grid gap-6 rounded-3xl bg-white p-5 shadow-[0_2px_4px_rgba(14,42,46,0.06),0_32px_64px_-24px_rgba(10,61,57,0.35)] sm:p-7 lg:grid-cols-[210px_1fr_230px] lg:items-center"
    >
      <div>
        <h2 id="selector-title" className="text-xl font-semibold leading-tight sm:text-[23px]">
          Que souhaitez-vous réaliser ?
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-snug text-ip-muted">Choisissez un service : nous revenons vers vous avec une proforma sur mesure.</p>
      </div>
      <div role="radiogroup" aria-labelledby="selector-title" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {quoteServices.map((s) => {
          const Icon = icons[s.id];
          const on = s.id === service;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setService(s.id)}
              className={cn(
                "relative flex flex-col gap-2.5 rounded-2xl border-[1.5px] p-3.5 text-left transition-colors",
                on ? "border-ip-teal bg-[#F4FAF9] shadow-[inset_0_0_0_1px_var(--color-ip-teal)]" : "border-ip-line hover:border-ip-teal/60",
              )}
            >
              {on && (
                <span className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-ip-teal text-white" aria-hidden="true">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <span className={cn("inline-flex size-10 items-center justify-center rounded-xl", on ? "bg-ip-teal text-white" : "bg-ip-mist text-ip-teal")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-heading text-[15px] font-semibold leading-tight">{s.label}</span>
              <span className="hidden text-xs leading-snug text-ip-muted sm:block">{s.hint}</span>
            </button>
          );
        })}
      </div>
      <div>
        <p id="size-label" className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ip-muted">
          Taille du projet
        </p>
        <div role="radiogroup" aria-labelledby="size-label" className="mb-3 flex gap-1 rounded-xl bg-ip-mist p-1">
          {projectSizes.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === size}
              aria-label={p.long}
              onClick={() => setSize(p.id)}
              className={cn(
                "h-9 flex-1 rounded-lg text-[12.5px] font-semibold",
                p.id === size ? "bg-white text-ip-ink shadow-[0_1px_3px_rgba(14,42,46,0.12)]" : "text-ip-muted hover:text-ip-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Link
          href={quoteHref(service, size)}
          data-testid="selector-cta"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ip-teal font-bold text-white hover:bg-ip-teal-600"
        >
          Recevoir ma proforma <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
