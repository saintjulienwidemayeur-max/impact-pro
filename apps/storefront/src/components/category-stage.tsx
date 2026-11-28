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
    <div className="relative h-full overflow-hidden bg-ip-sun" aria-hidden="true">
      {[
        { top: "16%", cls: "bg-ip-teal text-white", words: ["BANDANAS", "MOUCHOIRS", "BRACELETS", "BANDANAS"] },
        { top: "48%", cls: "bg-ip-ink text-ip-sun", words: ["CARNAVAL", "FESTIVALS", "CONCERTS", "CARNAVAL"] },
        { top: "80%", cls: "bg-ip-cyan text-ip-ink", words: ["T-SHIRTS", "CASQUETTES", "DRAPEAUX", "T-SHIRTS"] },
      ].map((b) => (
        <div key={b.top} className={`absolute -inset-x-1/3 flex h-11 -translate-y-1/2 -rotate-12 items-center gap-5 whitespace-nowrap pl-5 font-heading text-lg font-semibold ${b.cls}`} style={{ top: b.top }}>
          {b.words.map((w, i) => (
            <span key={w + i} className="flex items-center gap-5">
              {w} <Sparkle className="size-3.5 fill-current" />
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
};


/** Product composition (or provisional graphic) illustrating a promotional-items category. */
export function CategoryStage({ slug }: { slug: PromoCategorySlug }) {
  return <>{stages[slug]}</>;
}
