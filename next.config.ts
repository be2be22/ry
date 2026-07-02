import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.railway.app", "*.up.railway.app"],
  // Mark these packages as external so Next.js includes them in standalone build
  // and doesn't try to bundle them. This ensures bcryptjs, otplib, qrcode, etc.
  // are available at runtime in the standalone server.
  serverExternalPackages: [
    "bcryptjs",
    "otplib",
    "@otplib/core",
    "@otplib/hotp",
    "@otplib/totp",
    "@otplib/plugin-base32-scure",
    "@otplib/plugin-crypto-noble",
    "qrcode",
    "systeminformation",
    "jsonwebtoken",
    "@prisma/client",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
