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
    const executablePath = await chromium.executablePath();
    return playwright.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  const executablePath = process.env.PORTAL_CHROME_PATH;
  if (executablePath) {
    return playwright.launch({ executablePath, headless: true });
  }
  return playwright.launch({ channel: 'chrome', headless: true });
}
