import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { CartProvider } from "@/components/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

// Self-hosted Google Fonts (SIL OFL 1.1), latin subset, variable weight — no build-time network fetch.
const fredoka = localFont({
  src: "./fonts/fredoka-latin-var.woff2",
  weight: "300 700",
  variable: "--font-fredoka",
  display: "swap",
  fallback: ["ui-rounded", "system-ui", "sans-serif"],
});
const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["articles promotionnels", "Haïti", "tasses personnalisées", "t-shirts", "polos brodés", "banderoles", "cartes de visite", "photocall"],
  icons: {
    icon: [
      { url: "/brand/icon-ip-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-ip-64.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/icon-ip-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/icon-ip-192.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_HT",
    siteName: site.name,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    images: [{ url: "/brand/icon-ip.png", width: 512, height: 512, alt: "Impact Pro" }],
  },
  twitter: { card: "summary", title: site.name, description: site.description, images: ["/brand/icon-ip.png"] },
};

export const viewport: Viewport = {
  themeColor: "#0A716A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#contenu" className="sr-only z-[100] rounded-lg bg-ip-sun px-4 py-2 font-semibold text-ip-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Aller au contenu
        </a>
        <CartProvider>
          <SiteHeader />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <Toaster position="bottom-right" richColors closeButton />
        </CartProvider>
      </body>
    </html>
  );
}
