import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/copilot/actions/:path*",
        destination: "http://127.0.0.1:8000/api/copilot/actions/:path*",
      },
      {
        source: "/api/copilot/stream",
        destination: "http://127.0.0.1:8000/api/copilot/chat",
      },
    ];
  },
};

export default nextConfig;
