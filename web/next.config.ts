import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi load the dev server (local testing only; ignored in production)
  allowedDevOrigins: ["192.168.31.175"],
};

export default nextConfig;
