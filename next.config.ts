import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: [],
  experimental: { cpus: 2 },
};
export default config;
