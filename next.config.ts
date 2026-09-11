import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Playwright と同梱 Chromium はバンドルせず、実行時に node_modules から読む
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
