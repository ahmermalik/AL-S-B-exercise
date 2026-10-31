import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./.env*", "./.git/**/*", "./test-results/**/*", "./playwright-report/**/*", "./docs/**/*", "./tests/**/*"],
  },
};
export default config;
