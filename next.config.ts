import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @neondatabase/serverless requires Node.js runtime (not Edge)
  // and must be treated as an external package in the server bundle.
  serverExternalPackages: ["@neondatabase/serverless"],

  // Disable x-powered-by header for a cleaner response profile
  poweredByHeader: false,
};

export default nextConfig;
