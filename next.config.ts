import type { NextConfig } from "next";

// Build ID unique pour invalider les caches client (Server Actions) après chaque déploiement.
const buildId = `build-${Date.now()}`;

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
