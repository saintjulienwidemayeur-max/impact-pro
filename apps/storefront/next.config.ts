import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo root (pnpm workspace) — used for output file tracing.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  // Render free instances have 512 MB: the on-demand image optimizer (sharp) caused out-of-memory kills.
  // Photos are already compressed WebP/JPEG (≤ 220 KB each), so they are served as-is.
  images: { unoptimized: true },
  /**
   * Account calls must be same-origin: the storefront and the API live on different sites (e.g. *.onrender.com, a
   * public-suffix domain) and Safari / Chrome block third-party cookies, so a session cookie set by the API origin would
   * never be stored. These rewrites make the browser talk to the storefront origin, which forwards to the API (Cookie
   * and Set-Cookie travel through). The destination is resolved at BUILD time: set API_URL (or NEXT_PUBLIC_API_URL).
   * Public calls (catalog, uploads, guest orders) keep going straight to the API.
   */
  async rewrites() {
    const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
    return [
      { source: "/api/v1/auth/:path*", destination: `${api}/api/v1/auth/:path*` },
      { source: "/api/v1/me/:path*", destination: `${api}/api/v1/me/:path*` },
      { source: "/api/v1/custom-orders", destination: `${api}/api/v1/custom-orders` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
