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
