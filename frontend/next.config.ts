import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  // Rewrites proxy to BACKEND_URL; default proxy timeout (~30s) closes long CP-SAT generates → ECONNRESET.
  experimental: {
    proxyTimeout: 600_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
