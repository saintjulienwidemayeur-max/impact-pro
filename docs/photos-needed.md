# Photos needed for the customizer

The live preview needs **one clean product photo per product** (see `apps/storefront/src/config/product-media.ts` and
`new-products-media.json`). These products are in the catalog but have **no photo yet** (the storefront shows a neutral
« photo à venir » tile and a plain print-area frame until a photo exists):

| Product (slug) | Photos wanted |
|---|---|
| Ballons personnalisés (`ballon-personnalise`) | 1 balloon, front, inflated, one solid colour (ideally a white or colour balloon **without** any print) |
| Tente pliante 3×3 m (`tente-pliante-3x3`) | Whole tent, ¾ view, plain white (or plain colour) roof and side walls, no print |
| Roll-up (`roll-up`) | Roll-up stand, front view, blank white banner |
| Autocollants (`autocollants`) | A sheet of round/rectangular stickers or one blank sticker |
| Flyers / brochures (`flyers-brochures`) | A5/A4 sheet flat, front, blank white |
| Tablier (`tablier`) | Apron worn or flat, front view, plain colour (white or black) |
| Bandwòl / drapeau / photocall (existing) | Optional: blank (unprinted) versions of the banner, flag and photocall wall |
| T-shirt (`t-shirt-personnalise`) | Front **and back** of a plain T-shirt (white + a dark colour) — today the polo photos are used |
| Back views (all garments, bags, caps) | A back-view photo lets the « Dos » zone preview be exact (otherwise the front photo is used as an approximate preview) |

## Photo spec

- **Plain white or light-grey background** (a background remover can then cut the product out automatically); no props, no hands, no text.
- **Front view, centred**, whole product in frame, soft even light (no hard shadows). A product photographed **blank (no logo printed)** is ideal; if a sample logo is printed it can be removed afterwards.
- **≥ 1200 px** on the longest side, **PNG or JPG**, not a screenshot of a screenshot (the kit photo we have is only 736 px, so its items look soft when enlarged).
- One file per colour you want to offer (e.g. white and royal-blue mug, white and teal polo).
- You must own the photo or have the licence for commercial web use (avoid stock images with a watermark).

Send the files and say which product each one is for; they are then cut out, a logo-free version is prepared, and the print area is calibrated.
