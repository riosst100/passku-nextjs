import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR/dev-resource requests from any *.local hostname (e.g. passku.local)
  // and the LAN IP, so local domain mapping tools work without editing this file.
  allowedDevOrigins: ["*.local", "10.145.252.226"],
};

export default nextConfig;
