import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/flow-test": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
