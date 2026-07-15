import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Avatar uploads go through a server action. The default body limit is 1 MB;
    // we resize images client-side to well under that, but raise it modestly for
    // safety (kept under Vercel's ~4.5 MB function payload limit).
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
}

export default nextConfig
