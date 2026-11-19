import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["node:sqlite"],
  turbopack: { root: process.cwd() },
};
export default config;
