import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["node:sqlite", "@netlify/database"],
  outputFileTracingExcludes: { "/*": ["./data/**/*"] },
  turbopack: { root: process.cwd() },
};
export default config;
