import { Gift, Megaphone, Package, type LucideIcon } from "lucide-react";
import type { PromoCategorySlug } from "./offer";

export const categoryIcons: Record<PromoCategorySlug, LucideIcon> = {
  giveaways: Gift,
  "cadeaux-corporate": Package,
  "evenements-de-masse": Megaphone,
};
