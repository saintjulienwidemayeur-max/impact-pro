import { Landmark } from "lucide-react";

/** Payment method marks shown in the footer / checkout. Simplified vector marks, white tile. */
const tile = "inline-flex h-8 min-w-[3.25rem] items-center justify-center rounded-md bg-white px-2";

export function PaymentLogos({ className }: { className?: string }) {
  return (
    <ul className={className ?? "flex flex-wrap items-center justify-center gap-2"} aria-label="Moyens de paiement acceptés">
      <li className={tile} title="Visa">
        <svg viewBox="0 0 64 22" className="h-4 w-auto" role="img" aria-label="Visa">
          <text x="32" y="18" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="22" fill="#1A1F71">
            VISA
          </text>
        </svg>
      </li>
      <li className={tile} title="Mastercard">
        <svg viewBox="0 0 40 24" className="h-5 w-auto" role="img" aria-label="Mastercard">
          <circle cx="14" cy="12" r="10" fill="#EB001B" />
          <circle cx="26" cy="12" r="10" fill="#F79E1B" />
          <path d="M20 4.2a10 10 0 0 1 0 15.6 10 10 0 0 1 0-15.6z" fill="#FF5F00" />
        </svg>
      </li>
      <li className={`${tile} gap-1`} title="Zelle">
        <span className="rounded bg-[#6D1ED4] px-1.5 py-0.5 text-xs font-extrabold leading-none text-white">Zelle</span>
      </li>
      <li className={`${tile} gap-1.5 text-xs font-bold text-ip-ink`} title="Virement bancaire">
        <Landmark className="size-4 text-ip-teal" aria-hidden="true" />
        Virement
      </li>
      <li className={`${tile} text-xs font-bold text-ip-ink`} title="Dépôt bancaire">
        Dépôt
      </li>
    </ul>
  );
}
