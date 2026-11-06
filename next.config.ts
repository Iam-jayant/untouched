import type { NextConfig } from "next";
import path from "path";

const x402Stub = path.join(process.cwd(), "src/lib/x402-stub.js");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@wagmi/connectors$": path.join(process.cwd(), "src/lib/wagmi-connectors-shim.js"),
      "@x402/evm/exact/client": x402Stub,
      "@x402/evm/upto/client": x402Stub,
    };
    config.externals = Array.isArray(config.externals)
      ? [...config.externals, "pino-pretty", "lokijs", "encoding"]
      : [config.externals, "pino-pretty", "lokijs", "encoding"];
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

export default nextConfig;
