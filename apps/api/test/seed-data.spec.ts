import { PricingMode } from '@prisma/client';
import { categories, optionFlags, products } from '../prisma/seed-data';

/** Sanity checks on the catalog seed: every product exposes exactly the options that make sense for it. */
describe('catalog seed data', () => {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const get = (slug: string) => {
    const p = bySlug.get(slug);
    if (!p) throw new Error(`seed product missing: ${slug}`);
    return p;
  };

  it('has unique slugs and known categories', () => {
    expect(bySlug.size).toBe(products.length);
    const cats = new Set(categories.map((c) => c.slug));
    expect(cats.size).toBe(categories.length);
    for (const p of products) expect(cats.has(p.categorySlug)).toBe(true);
  });

  it.each(products.map((p) => [p.slug, p] as const))('%s: option labels and flags are consistent', (_slug, p) => {
    const f = optionFlags(p);
    expect(f.colorLabel.trim()).not.toBe('');
    expect(f.sizeLabel.trim()).not.toBe('');
    // required ⇒ a non-empty list to choose from
    if (f.colorsRequired) expect(p.colors?.length ?? 0).toBeGreaterThan(0);
    if (f.sizesRequired) expect(p.sizes?.length ?? 0).toBeGreaterThan(0);
    // values fit the order DTO limits and are unique
    for (const c of p.colors ?? []) expect(c.length).toBeLessThanOrEqual(40);
    for (const s of p.sizes ?? []) expect(s.length).toBeLessThanOrEqual(60);
    expect(new Set(p.colors ?? []).size).toBe((p.colors ?? []).length);
    expect(new Set(p.sizes ?? []).size).toBe((p.sizes ?? []).length);
    // custom-size products use `sizes` only as quick presets, never as a required choice
    if (p.customSize) expect(f.sizesRequired).toBe(false);
    // pricing / capabilities
    if (p.pricingMode === PricingMode.PER_AREA) expect(p.customSize).toBeDefined();
    if (p.artworkRequired) expect(p.supportsArtwork).toBe(true);
    expect(p.supportsLogo !== false || p.supportsText !== false || p.supportsArtwork === true).toBe(true);
    expect(p.placements.length).toBeGreaterThan(0);
    expect(new Set(p.placements).size).toBe(p.placements.length);
    // tiers are ascending and start at the minimum order quantity
    const mins = p.tiers.map(([q]) => q);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    expect(mins[0]).toBe(p.minOrderQty);
    for (const img of p.images) expect(img.startsWith('/photos/')).toBe(true);
  });

  it('the football has no options at all (no size for a ball)', () => {
    const ball = get('ballon-football');
    expect(ball.sizes ?? []).toEqual([]);
    expect(ball.colors ?? []).toEqual([]);
    const f = optionFlags(ball);
    expect(f.sizesRequired).toBe(false);
    expect(f.colorsRequired).toBe(false);
    expect(ball.placements).toEqual(expect.arrayContaining(['FRONT', 'BACK']));
  });

  it('products without a size dimension have an empty sizes list', () => {
    for (const slug of ['tasse-ceramique-11oz', 'casquette-brodee', 'sac-tote', 'sac-a-cordon', 'parapluie', 'stylos-personnalises', 'ballon-personnalise', 'porte-cles', 'protege-passeport', 'tablier', 'badge-lanyard', 'carnet-a5']) {
      expect(get(slug).sizes ?? []).toEqual([]);
    }
  });

  it('garments require color and size; products whose photo shows one colour offer no colour choice', () => {
    for (const slug of ['polo-brode', 't-shirt-personnalise']) {
      const f = optionFlags(get(slug));
      expect(f).toMatchObject({ colorsRequired: true, sizesRequired: true, sizeLabel: 'Taille' });
      expect(get(slug).sizes).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    }
    expect(get('t-shirt-personnalise').colors).toEqual(['Rouge', 'Noir', 'Bleu royal']);
    expect(get('polo-brode').colors).toEqual(['Teal', 'Blanc']);
    // Colours are only offered when a matching photo exists (otherwise the preview would show the wrong colour).
    for (const slug of ['casquette-brodee', 'tasse-ceramique-11oz', 'badge-lanyard', 'tente-pliante-3x3', 'gourde-aluminium', 'coque-telephone', 'sac-tote']) {
      expect(get(slug).colors ?? []).toEqual([]);
      expect(optionFlags(get(slug)).colorsRequired).toBe(false);
    }
  });

  it('product-specific labels follow the contract', () => {
    expect(optionFlags(get('coque-telephone')).sizeLabel).toBe('Modèle du téléphone');
    expect(get('coque-telephone').sizes?.length).toBeGreaterThanOrEqual(30);
    expect(get('coque-telephone').sizes).toContain('iPhone 15 Pro Max');
    expect(optionFlags(get('gobelet-cafe'))).toMatchObject({ sizeLabel: 'Capacité', colorLabel: 'Couleur du couvercle', sizesRequired: true });
    expect(get('gobelet-cafe').sizes).toEqual(['8 oz', '12 oz', '16 oz']);
    expect(optionFlags(get('gourde-aluminium'))).toMatchObject({ sizeLabel: 'Capacité', sizesRequired: true });
    expect(optionFlags(get('tente-pliante-3x3'))).toMatchObject({ sizeLabel: 'Dimensions', colorLabel: 'Couleur du toit', sizesRequired: true });
    expect(get('tente-pliante-3x3').sizes).toEqual(['3 × 3 m', '3 × 4,5 m', '3 × 6 m']);
    expect(optionFlags(get('roll-up'))).toMatchObject({ sizeLabel: 'Taille', sizesRequired: true });
    expect(get('roll-up').sizes).toEqual(['85 × 200 cm', '100 × 200 cm', '120 × 200 cm']);
    expect(optionFlags(get('drapeau-plume'))).toMatchObject({ sizeLabel: 'Hauteur', sizesRequired: true });
    expect(optionFlags(get('cartes-de-visite'))).toMatchObject({ sizeLabel: 'Finition', sizesRequired: true });
    expect(optionFlags(get('badge-lanyard'))).toMatchObject({ colorLabel: 'Couleur du lanyard', sizesRequired: false });
  });

  it('banners and photocall use a custom size, not a required preset', () => {
    for (const slug of ['banderole-pvc', 'photocall']) {
      const p = get(slug);
      expect(p.customSize).toBeDefined();
      expect(p.pricingMode).toBe(PricingMode.PER_AREA);
      expect(optionFlags(p).sizesRequired).toBe(false);
    }
  });
});
