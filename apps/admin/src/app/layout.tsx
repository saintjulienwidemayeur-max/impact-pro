import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

// Self-hosted Google Fonts (SIL OFL 1.1), latin subset — no build-time network fetch.
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
  title: { default: "Impact Pro · Administration", template: "%s · Impact Pro Admin" },
  description: "Back-office Impact Pro : commandes, clients, devis, factures.",
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [
      { url: "/brand/icon-ip-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-ip-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/icon-ip-192.png",
  },
};

export const viewport: Viewport = { themeColor: "#0A716A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-ip-mist">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
