import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old vanilla app one level up also has a package-lock.json, which makes
  // Next.js guess the workspace root wrong. Pin it explicitly to this folder.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
