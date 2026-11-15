import { chromium as playwright, type Browser } from 'playwright-core';

/**
 * ポータル自動操作用のブラウザ起動。
 * - Vercel / Lambda 上: @sparticuz/chromium が同梱する Chromium を使う
 * - ローカル: PORTAL_CHROME_PATH があればそれを、無ければインストール済み Chrome (channel) を使う
 */
export async function launchBrowser(): Promise<Browser> {
  const onServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (onServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    // 同じサーバーで別の処理が /tmp/chromium を書き出している最中だと
    // spawn ETXTBSY で失敗することがあるので、少し待って数回やり直す
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const executablePath = await chromium.executablePath();
        return await playwright.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        });
      } catch (e) {
        lastError = e;
        if (!/ETXTBSY|EBUSY/.test((e as Error).message ?? '')) throw e;
        await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  const executablePath = process.env.PORTAL_CHROME_PATH;
  if (executablePath) {
    return playwright.launch({ executablePath, headless: true });
  }
  return playwright.launch({ channel: 'chrome', headless: true });
}
