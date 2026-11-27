import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  // Render free instances have 512 MB: no on-demand image optimizer.
  images: { unoptimized: true },
  /**
   * Same-origin proxy (cookies stay first-party, Safari-safe): the admin origin forwards auth, admin and upload calls
   * to the API. The destination is resolved at BUILD time: set API_URL (or NEXT_PUBLIC_API_URL).
   */
  async rewrites() {
    const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
    return [
      { source: "/api/v1/auth/:path*", destination: `${api}/api/v1/auth/:path*` },
      { source: "/api/v1/admin/:path*", destination: `${api}/api/v1/admin/:path*` },
      { source: "/api/v1/uploads/:path*", destination: `${api}/api/v1/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          // SAMEORIGIN (not DENY): the PDF preview is an iframe of our own origin.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
