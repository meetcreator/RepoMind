/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },
  // Allow bigger body for SSE streaming
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;

