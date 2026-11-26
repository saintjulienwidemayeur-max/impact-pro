# Customizer v2 — shared contract (backend · storefront · assets)

User requirements (Haitian Creole, summarized): in « Personnaliser » a customer can
- put a logo on the front **and** write text on the back (several zones per product: front, back, sleeve, side…);
- add several logos, and write text on the items (font, color);
- for banners / large-format items: upload **their own ready-to-print file**;
- **remove the logo's background** while adding it;
- customize more products: balloons, tents, roll-ups, bags, umbrellas, bottles, USB keys, etc. (« tout bagay »).

## 1. Placements (enum `PrintPlacement`)
Existing: `FRONT, BACK, CHEST_LEFT, SLEEVE, WRAP, FULL`. Add: `SIDE`, `TOP`.
French labels: FRONT Devant · BACK Dos · CHEST_LEFT Cœur (poitrine gauche) · SLEEVE Manche · WRAP Tour complet · FULL Pleine surface · SIDE Côté · TOP Dessus / toit.

## 2. Uploads
- `POST /api/v1/uploads/logos` (existing): PNG/JPEG/WEBP/PDF ≤ 10 MB. The storefront uploads the *processed* PNG (background removed) here.
- **New** `POST /api/v1/uploads/artwork`: multipart `file`; PNG/JPEG/WEBP/PDF, magic-byte checked, **≤ 25 MB** (env `UPLOAD_ARTWORK_MAX_BYTES`, default 26214400); same response shape `{ data: { id, url, mimeType, size, originalName, width?, height? } }` with `url = /api/v1/uploads/artwork/{id}`; `GET /api/v1/uploads/artwork/:id` streams it (same headers as logos). `Upload.purpose` enum `LOGO | ARTWORK`. Both endpoints keep the CORS/CORP headers and throttling.
- Response of both uploads gains optional `width`, `height` (px, images only).

## 3. Catalog (`GET /api/v1/catalog/products[/:slug]`) — new fields per product
```
pricingMode: "PER_PIECE" | "PER_AREA"      // PER_AREA: priceTiers.unitPrice = HTG per m²
supportsLogo: boolean      // default true
supportsText: boolean      // default true
supportsArtwork: boolean   // « importer mon fichier prêt à imprimer »
artworkRequired: boolean   // true for banners/flags/roll-ups/photocall…
customSize: null | { minWidthCm, maxWidthCm, minHeightCm, maxHeightCm, defaultWidthCm, defaultHeightCm, minBillableM2 }
zones: [{ placement, label, maxElements }]   // derived from placements, in display order
```
Existing fields unchanged (slug, name, description, category, currency, basePrice, compareAtPrice, minQty, unitLabel, colors, sizes, placements, priceTiers, images).

## 4. Custom order payload — `POST /api/v1/custom-orders`
```
item = {
  productSlug, quantity, color?, size?, notes?,
  widthCm?, heightCm?,                      // required when product.customSize != null
  elements: [ {                             // 1..30
      placement,                            // must be in product.placements
      kind: "LOGO" | "TEXT" | "ARTWORK",    // must be supported by the product
      uploadId?,                            // uuid, required for LOGO (purpose LOGO|ARTWORK ok) and ARTWORK, < 7 days old
      text?,                                // required for TEXT, 1..200 chars, max 6 lines (\n)
      font?,                                // TEXT: one of "fredoka"|"inter"|"pacifico"|"bebas-neue"|"playfair"|"montserrat"|"dancing-script"|"oswald"; default "inter"
      fontWeight?,                          // "regular" | "bold"
      color?,                               // TEXT: "#RRGGBB", default "#000000"
      align?,                               // "left"|"center"|"right"
      x, y,                                 // element center offset inside the print area, fraction of area w/h, −0.5..0.5
      scale,                                // 0.05..4 (1 = fits the area, contain-fit)
      rotation,                             // −180..180 degrees
      sort?                                 // layer order (int); server assigns by array index when absent
  } ]
}
```
Legacy shorthand `{ placement, logoUploadId }` is still accepted and converted to one centered LOGO element (x=y=0, scale=1, rotation=0). Client prices are ignored (as today).
Rules: `artworkRequired` ⇒ ≥1 ARTWORK element; ARTWORK element only if `supportsArtwork`; TEXT only if `supportsText`; LOGO only if `supportsLogo`.

Pricing (server side, money as strings with 2 decimals):
- PER_PIECE: tier by quantity (as today).
- PER_AREA: `areaM2 = max(widthCm*heightCm/10000, minBillableM2)`; rate = tier unitPrice (per m²) chosen by **quantity**; `unitPrice = round(areaM2 * rate, 2)`; `lineTotal = unitPrice * quantity`.
Order/tracking response item adds: `widthCm?, heightCm?, areaM2?, elements: [{ placement, kind, text?, font?, fontWeight?, color?, align?, x, y, scale, rotation, sort, logoUrl? (for LOGO/ARTWORK: relative url of the upload), originalName? }]`. Existing item fields stay (`placement`/`logoUrl` = first element's, for old consumers).
Errors: 422 VALIDATION_ERROR (details per field, e.g. `items.0.elements.1.text`), 422 `ELEMENT_NOT_SUPPORTED`, 422 `ARTWORK_REQUIRED`, 422 `SIZE_OUT_OF_RANGE`, plus existing codes.

DB: new table `CustomOrderItemElement` (id, itemId FK cascade, sort int, placement, kind, uploadId FK?, text, font, fontWeight, color, align, x, y, scale, rotation, createdAt; unique (itemId, sort)). `CustomOrderItem` gets `widthCm`, `heightCm`, `areaM2` (nullable decimals). Keep legacy columns (`placement`, `logoUploadId`) nullable, filled from the first element.

## 5. Storefront persisted design (cart, localStorage key `impactpro.cart.v3`)
Same element shape as §4 plus `logoUrl`/`originalName`/`mimeType` for display. Per-zone preview photos come from `src/config/product-media.ts`.

## 6. New catalog products (slug → notes) — seed with placeholder HTG prices (flag as placeholders)
ballon-personnalise (latex 12", FRONT/BACK, min 100, colors) · tente-pliante-3x3 (PER_PIECE, TOP/SIDE/FRONT/BACK, sizes 3×3/3×4.5/3×6 m) · roll-up (85×200 cm, ARTWORK required, FRONT) · autocollants (PER_AREA… or PER_PIECE; FRONT) · flyers-brochures (A5/A4, FRONT/BACK, ARTWORK allowed) · sac-tote (FRONT/BACK) · sac-a-cordon (FRONT/BACK) · parapluie (FRONT, TOP) · gourde-isotherme (WRAP/FRONT) · gobelet-isotherme (WRAP/FRONT) · cle-usb (FRONT) · porte-cles (FRONT/BACK) · protege-passeport (FRONT) · tablier (FRONT/BACK).
Existing banners/flags/photocall become ARTWORK-capable: banderole-pvc, drapeau-plume, photocall (`pricingMode PER_AREA` for banderole-pvc & photocall with `customSize`; drapeau-plume stays PER_PIECE with sizes). T-shirt/polo/casquette/tasse/carnet/stylos: logo + text, multi-zone (polo: FRONT, BACK, CHEST_LEFT, SLEEVE; casquette: FRONT, SIDE, BACK; tasse: FRONT, WRAP).
Photos exist only for some (see assets agent); products without a photo use a neutral on-brand « photo à venir » tile and a plain print-area frame for the live preview.

## 7. Addendum — product parameters, final preview, football (owner feedback, 2nd round)
Owner (Haitian Creole): « each product must have the appropriate parameters, so that we don't ask for a size for a ball; and the customer must see how it will look when finished ». « balon » = **football** (a soccer ball photo was sent), not only party balloons.

### 7.1 Product options (API + storefront)
New catalog fields: `colorLabel` (default "Couleur"), `sizeLabel` (default "Taille"), `colorsRequired` (bool), `sizesRequired` (bool). The storefront shows a color / size selector **only** when the product's `colors` / `sizes` arrays are non-empty, with these labels, and marks them required per the flags. Order validation: `COLOR_REQUIRED`, `SIZE_REQUIRED` (422) when required and missing; unknown value → `INVALID_OPTION`. Products that need no size must have `sizes: []` (ball, mug, cap, tote, balloons, stylos, USB, keyring…).
Examples: t-shirt/polo (Couleur required, Taille required S–XXL) · casquette (Couleur only) · tasse (Couleur only, e.g. Blanc/Noir/Ble…) · gourde (Capacité 500/750 ml required, Couleur) · coque-telephone (sizeLabel "Modèle du téléphone", required, list of common iPhone/Samsung/Tecno/Infinix models) · gobelet-cafe (sizeLabel "Capacité" 8/12/16 oz required, Couleur du couvercle) · ballon-football (no options; fixed size 5, mention in description) · ballon-personnalise (party balloons: Couleur only) · tente-pliante (sizeLabel "Dimensions" 3×3/3×4.5/3×6 m required, Couleur du toit) · roll-up (sizeLabel "Format" 85×200/100×200/120×200 cm required) · drapeau-plume (sizeLabel "Hauteur" S 2,3 m / M 3,4 m / L 4,5 m required) · banderole/photocall (customSize) · cartes-de-visite (sizeLabel "Finition" Mat/Brillant/Pelliculage soft-touch required) · tablier (Couleur, Taille unique → none) · badge-lanyard (Couleur du lanyard).

### 7.2 Final preview (« voir le rendu final »)
- Storefront: button « Voir le rendu final » opens a clean modal with every zone rendered (no handles), large, with « Télécharger l'aperçu (PNG) ». Real rendered mock-up thumbnails (not just lists) in the cart, checkout summary, confirmation and /suivi.
- Canvas export needs untainted canvases: logos/artwork are loaded with `crossOrigin="anonymous"` (API already sends ACAO for allowed origins + CORP cross-origin); fall back gracefully (no export) if it fails.
- API: new upload purpose `PREVIEW`: `POST /api/v1/uploads/previews` (PNG/JPEG, magic-byte checked, ≤ 3 MB, same response shape, `GET /api/v1/uploads/previews/:id`). Order item gets optional `previews: [{ placement, uploadId }]` (≤ 12); response items return `previews: [{ placement, url }]`. Storefront uploads one rendered PNG per zone at checkout (best effort: if it fails the order still goes through).

### 7.3 Perspective print areas
Print areas may be given as `quad: [[x,y],[x,y],[x,y],[x,y]]` (TL, TR, BR, BL; fractions of image width/height) instead of cx/cy/w/h/rot, plus an optional `aspect` (w/h of the flat print area, needed to compose the layer). The renderer maps the flat composed layer onto the quad with a subdivided-triangle perspective warp, then applies the usual shading. Used for roll-up ¾ view, tent walls/roof, brochure panels, banner photos.

### 7.4 New / updated products (slugs)
ballon-football (zones FRONT, BACK; sphere → mild cylindrical `curve`) · coque-telephone · gourde-aluminium · gobelet-cafe (white + black lid photos) · badge-lanyard · t-shirt-personnalise (colors Rouge/Bleu royal/Noir/Blanc, real FRONT + BACK photos) · casquette-brodee (real SIDE photo) · sac-tote (white photo added as color Blanc) · roll-up (real photos) · tente-pliante-3x3 (real photo) · flyers-brochures (blank tri-fold photo) · banderole-pvc (blank textile banner cut-outs). Reference-only (do not publish, third-party designs): incoming 03, 16, 18, 22.
