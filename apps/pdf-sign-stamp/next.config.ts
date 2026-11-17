import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // Do not enable cacheComponents or partialPrefetching.
  // Both hang and return 500 on Cloudflare Workers.
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
