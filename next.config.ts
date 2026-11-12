import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // make sure the SQLite database (updated by scripts/scrape.mjs and committed
  // by the auto-scrape workflow) is bundled into the serverless function
  outputFileTracingIncludes: {
    "/api/jobs": ["./data/jobs.db"],
  },
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
