# Photos for the customizer

The live preview needs **one clean, blank product photo per product** (see `apps/storefront/src/config/product-media.ts`
and `new-products-media.json`). Products without a photo show a neutral « Photo à venir » tile and a plain print-area frame.

## Covered (photos supplied by the owner, cut out and calibrated)

| Product | Photos | Notes |
|---|---|---|
| T-shirt (`t-shirt-personnalise`) | rouge, bleu royal, noir: front + back; **blanc = rendu** (light recolouring of the red shirt) | ~650–850 px: soft above ~500 px. Zones FRONT, CHEST_LEFT, SLEEVE, BACK |
| Casquette (`casquette-brodee`) | front (brand book) + **profile** (zone SIDE) | no back view yet (BACK stays approximate) |
| Sac tote (`sac-tote`) | royal blue (kit) + **white** (colour Blanc) | BACK uses the front photo (approximate) |
| Coque de téléphone (`coque-telephone`) | white, back of phone | FRONT/FULL zone avoids the camera block |
| Gourde aluminium (`gourde-aluminium`) | white 750 ml bottle + carabiner | the small 236 px bottle photo was not usable (too small, cut-out has a hole) |
| Gobelet café (`gobelet-cafe`) | white lid, black lid (2 cups per photo) | logo is placed on the foreground cup; the two cups overlap so they could not be split |
| Badge + lanyard (`badge-lanyard`) | blank badge, 2 sizes | BACK approximate |
| Ballon de football (`ballon-football`) | classic black/white ball | print area = central white panel; BACK approximate |
| Roll-up (`roll-up`) | front view + ¾ view (perspective area) | |
| Tente pliante (`tente-pliante-3x3`) | white tent with one side wall + « stand complet » illustration | zones TOP (roof), FRONT (valance), SIDE (wall) as perspective quads; roof outline is slightly jagged |
| Flyers / brochures (`flyers-brochures`) | blank tri-fold, ¾ view | perspective area on the middle panel (FRONT) and right panel (BACK, approximate) |
| Banderole (`banderole-pvc`) | clean blank hanging banner (cut from the owner's vector sheet, 891×468 after 3× upscale) | the previous scene photo stays as gallery image #2 |
| Polo, tasse, carnet, stylos, parapluie, gourde isotherme, USB, porte-clés, passeport… | brand book / kit photos | see earlier notes |

Not usable (watermark or third-party printed designs): incoming 02 and 11 (Freepik watermark), 03, 16, 18, 22 (printed third-party designs).
A feather flag (« drapeau plume ») cut-out was **not** possible from the vector sheet (it only has rectangular flags/banners).

## Still missing

| Product (slug) | Photos wanted |
|---|---|
| Ballons de fête (`ballon-personnalise`, latex/party balloons) | 1 balloon, front, inflated, one solid colour, **no print** |
| Autocollants (`autocollants`) | A sheet of round/rectangular stickers or one blank sticker |
| Tablier (`tablier`) | Apron, front view, plain colour (white or black) |
| Drapeau plume (`drapeau-plume`) | A blank feather flag on its base (the brand-book flags have the sample logo and are low resolution) |
| Photocall (`photocall`) | A blank step-and-repeat wall |
| Back views | Casquette (back), polo blanc (back/sleeve), sacs (back), badge, coque (the real back is the visible side) — otherwise the BACK zone is an approximate preview |
| Colours | One photo per colour you want to offer (mug, polo, cap, tote…) |

## Photo spec

- **Plain white or light-grey background** (a background remover then cuts the product out); no props, no hands, no text.
- **Front view, centred**, whole product in frame, soft even light (no hard shadows). A product photographed **blank (no logo printed)** is ideal; a sample logo can be removed afterwards.
- **≥ 1200 px** on the longest side, **PNG or JPG**, not a screenshot of a screenshot.
- One file per colour. You must own the photo or have a licence for commercial web use (avoid stock images with a watermark).

Send the files and say which product each one is for; they are cut out, a logo-free version is prepared, and the print area is calibrated.
