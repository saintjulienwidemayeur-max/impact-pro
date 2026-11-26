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
