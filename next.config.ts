import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Playwright と同梱 Chromium はバンドルせず、実行時に node_modules から読む
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  // 同梱 Chromium の実体（bin/ 配下の圧縮バイナリ）はファイル追跡で拾われないため、
  // ポータル同期を行うルートに明示的に同梱する
  outputFileTracingIncludes: {
    '/api/admin/vendors/[id]/portal-sync': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/cron/portal-sync': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    // 同意書の PDF 作成にも同じ Chromium を使う
    '/api/contracts/[token]/sign': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/admin/contracts/[id]/pdf': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
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
