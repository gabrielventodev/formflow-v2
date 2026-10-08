import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // Dev only: extra hosts that may open the dev server, e.g. a tunnel to test the liveness QR on a phone.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((h) => h.trim()).filter(Boolean),
};

export default nextConfig;
