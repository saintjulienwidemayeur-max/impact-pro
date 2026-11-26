import { ProductVisual } from "./product-visual";

/** Hero composition of branded items, built from brand SVG illustrations (no stock photos). */
export function HeroArt() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-xl" aria-hidden="true">
      {/* Notebook (behind) */}
      <div className="absolute left-[0%] top-[4%] w-[28%] rotate-[-10deg]">
        <ProductVisual product={{ visual: "notebook", tone: "teal", name: "Carnet" }} />
      </div>
      {/* Big polo */}
      <div className="absolute left-[18%] top-[2%] w-[62%] rotate-[-4deg] rounded-[1.75rem] bg-white/10 p-2 backdrop-blur-[1px]">
        <ProductVisual product={{ visual: "polo", tone: "white", name: "Polo" }} />
      </div>
      {/* Mug */}
      <div className="absolute bottom-[4%] left-0 w-[42%] rotate-[3deg] rounded-[1.5rem] bg-white p-2 shadow-offset">
        <ProductVisual product={{ visual: "mug", tone: "white", name: "Tasse" }} />
      </div>
      {/* Cap */}
      <div className="absolute bottom-[0%] right-[2%] w-[44%] rotate-[-2deg] rounded-[1.5rem] bg-ip-mist p-2 shadow-[8px_8px_0_0_var(--color-ip-sun)]">
        <ProductVisual product={{ visual: "cap", tone: "white", name: "Casquette" }} />
      </div>
    </div>
  );
}
