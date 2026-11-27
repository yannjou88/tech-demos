import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Cache Components and partialPrefetching hang on Cloudflare Workers.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
