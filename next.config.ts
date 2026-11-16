import type { NextConfig } from "next";

// Статическая сборка для GitHub Pages: npm run build:pages (scripts/build-pages.mjs).
const staticSite = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

const nextConfig: NextConfig = {
  ...(staticSite
    ? {
        output: "export",
        // Сайт проекта на GitHub Pages живёт в подкаталоге с именем репозитория.
        basePath: process.env.PAGES_BASE_PATH || undefined,
        trailingSlash: true,
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
      }),
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
