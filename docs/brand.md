# Brand Guide for Developers — Impact Pro

Tagline: **« Votre marque, partout. »** Source: *Impact Pro · Identité visuelle* and `CLAUDE.md` §0.

## 1. Color tokens

| Token | HEX | RGB | Role | Share of a composition |
|---|---|---|---|---|
| `teal` | `#0A716A` | 10 113 106 | Primary: headers, buttons, teal sections | ~22% |
| `cyan` | `#42C6F0` | 66 198 240 | Secondary: highlights, links on dark, offset shadows | ~16% |
| `teal-deep` | `#0A3D39` | 10 61 57 | Shadows, dark surfaces (instead of black) | with yellow ~12% |
| `sun` | `#FFC93C` | 255 201 60 | Accent: primary CTA, badges, promo labels | small doses |
| `ink` | `#0E2A2E` | 14 42 46 | Body text, dark footer/bands | – |
| `mist` | `#F2F6F5` | 242 246 245 | Page background tint | – |
| `white` | `#FFFFFF` | – | Main surface | ~50% |

These tokens are available in JS from `@impact-pro/brand` (`colors`, `fonts`, `tagline`).

### Tailwind mapping (`tailwind.config.ts`)

```ts
import { colors as brand } from "@impact-pro/brand";

export default {
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: brand.teal, deep: brand.tealDeep },
        cyan: { DEFAULT: brand.cyan },
        sun: { DEFAULT: brand.sun },
        ink: { DEFAULT: brand.ink },
        mist: { DEFAULT: brand.mist },
        // shadcn/ui semantic tokens
        primary: { DEFAULT: brand.teal, foreground: "#FFFFFF" },
        secondary: { DEFAULT: brand.cyan, foreground: brand.ink },
        accent: { DEFAULT: brand.sun, foreground: brand.ink },
      },
      fontFamily: {
        heading: ["var(--font-fredoka)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "1.25rem", pill: "9999px" },
      boxShadow: {
        offset: `8px 8px 0 0 ${brand.cyan}`,      // cyan offset behind teal cards
        "offset-sm": `4px 4px 0 0 ${brand.cyan}`,
      },
    },
  },
};
```

Contrast (WCAG AA):
- White on `teal` ✔ (≈5.9:1) · `ink` on `sun` ✔ · `ink` on `cyan` ✔ · `teal` on `white` ✔
- ✘ White on `cyan` and white on `sun` fail. Use `ink` text on those colors.

## 2. Typography

Load both families with `next/font/google`:
- **Fredoka** (500/600/700) for headings, titles and prices in promo badges.
- **Inter** (400/500/600) for body text, prices, forms, tables, invoices and contacts.

| Style | Font | Size / line-height (desktop → mobile) | Weight |
|---|---|---|---|
| Display (hero) | Fredoka | 64/68 → 40/44 | 700 |
| H1 | Fredoka | 48/56 → 34/40 | 700 |
| H2 | Fredoka | 36/44 → 28/34 | 600 |
| H3 | Fredoka | 24/32 → 20/28 | 600 |
| Eyebrow / label | Inter | 12/16, uppercase, tracking 0.12em | 600 |
| Body L | Inter | 18/28 | 400 |
| Body | Inter | 16/24 | 400 |
| Small | Inter | 14/20 | 400–500 |
| Price | Inter | 18–20/28, tabular-nums | 600 |

## 3. Logo usage

- The logo is a **hand drawing, not a font**. Always use the files in `packages/brand/assets/` and never retype "Impact Pro" in a typeface as a logo.
  - `logo-impact-pro.png`: light backgrounds (white, mist).
  - `logo-impact-pro-inverse.png`: on `teal`, `teal-deep` or `ink`.
  - `icon-ip.png` (512), `icon-ip-192.png`, `icon-ip-64.png`, `icon-ip-32.png`: favicon, app icon, avatars, small spaces.
- Keep clear space of at least half the height of the "I" around the logo.
- Never stretch, rotate, recolor, outline or add effects. Minimum width: 120 px for the wordmark; below that, use the "IP" icon.
- Use `next/image` with explicit width and height, and `alt="Impact Pro"`.

## 4. Signature motifs

- **Rounded cards:** radius 16–24 px, white on mist, with a 1 px `#E3ECEA` border or a soft shadow.
- **Offset cyan shadow** behind teal cards and buttons (`shadow-offset`). This echoes the logo's shadow.
- **Stripe bar:** a bottom border made of a cyan segment (~78%) plus a yellow segment (~22%). Use it on footers, cards and banners.
- **Arcs:** large faint teal circles (`teal` at lighter opacity, or `#1A8A83`) behind hero or cover content on teal backgrounds.
- **Dark pill captions:** `teal-deep` or `ink` background, white Fredoka 14 px text, full radius. Use them on product photos.
- **Yellow round badges:** `sun` circle with `ink` Fredoka text, e.g. « Jusqu'à 30 % », « Merci ! ».

## 5. Voice and content

- Write in French first; Haitian Creole is a later locale. Tone: warm, direct and confident. Example: « Nous mettons votre marque sur tout. »
- Show prices in **HTG** (e.g. `1 250 HTG`) with `Intl.NumberFormat('fr-HT')`. Phone numbers use the `+509` format.
- Product universe: tasses, t-shirts & polos, casquettes, banderoles, drapeaux plume, cartes de visite & papeterie, carnets, stylos, étiquettes & sceaux, photocall.
