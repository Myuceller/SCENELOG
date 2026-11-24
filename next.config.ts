import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Allow phones on the same network to load dev assets using this computer's IP.
const localAddresses = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses ?? []).filter((address) => address.family === "IPv4" && !address.internal).map((address) => address.address),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: localAddresses,
  // Avoid merging deferred workspace styles into the small login screen.
  experimental: { cssChunking: "graph" },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/w500/**", search: "" }],
  },
};
export default nextConfig;
