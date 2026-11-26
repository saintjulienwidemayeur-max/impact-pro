/**
 * Products kept in the API catalog but NOT shown on the storefront, because their only photo is a low-resolution
 * crop of the promo-kit picture (736 px) with another company's sample logo. They come back as soon as a proper
 * photo is added to `new-products-media.json` and the slug is removed from this list.
 */
export const HIDDEN_PRODUCT_SLUGS: ReadonlySet<string> = new Set([
  "sac-a-cordon",
  "gobelet-isotherme",
  "gourde-isotherme",
  "porte-cles",
  "protege-passeport",
  "cle-usb",
  "parapluie",
]);

export const isHiddenProduct = (slug: string): boolean => HIDDEN_PRODUCT_SLUGS.has(slug);
