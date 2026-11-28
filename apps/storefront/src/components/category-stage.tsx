import Image from "next/image";
import { Sparkle } from "lucide-react";
import { Cutout } from "./cutout";
import type { PromoCategorySlug } from "@/config/offer";

const stages: Record<PromoCategorySlug, React.ReactNode> = {
  giveaways: (
    <div className="relative h-full bg-gradient-to-br from-[#E4F4FB] to-[#F4FAFC]">
      <Cutout src="/photos/stylos.webp" box={[5, 18, 26, 68]} />
      <Cutout src="/photos/tasse-11oz.webp" box={[26, 13, 44, 72]} />
      <Cutout src="/photos/ballon-football.webp" box={[64, 40, 31, 45]} />
    </div>
  ),
  "cadeaux-corporate": (
    <div className="relative h-full bg-[radial-gradient(120%_90%_at_70%_20%,#0F5A54,#0A3D39)]">
      <Cutout src="/photos/carnet-a5.webp" box={[8, 15, 36, 72]} />
      <Cutout src="/photos/polo-blanc-brode.webp" box={[40, 10, 40, 80]} />
      <Cutout src="/photos/casquette-profil.webp" box={[63, 55, 34, 31]} />
    </div>
  ),
  "evenements-de-masse": (
    <div className="relative h-full overflow-hidden bg-ip-sun">
      <Image src="/photos/carnaval-defile.webp" alt="Défilé de carnaval en Haïti" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover object-[center_60%]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ip-ink/60 to-transparent" />
      <div aria-hidden="true" className="absolute -inset-x-6 bottom-5 flex h-9 -rotate-3 items-center gap-4 whitespace-nowrap bg-ip-sun pl-6 font-heading text-[15px] font-semibold text-ip-ink shadow-lg">
        {["BANDANAS", "MOUCHOIRS", "BRACELETS", "T-SHIRTS", "CASQUETTES", "DRAPEAUX"].map((w) => (
          <span key={w} className="flex items-center gap-4">
            {w} <Sparkle className="size-3 fill-current text-ip-teal" />
          </span>
        ))}
      </div>
    </div>
  ),
};


/** Product composition (or provisional graphic) illustrating a promotional-items category. */
export function CategoryStage({ slug }: { slug: PromoCategorySlug }) {
  return <>{stages[slug]}</>;
}
