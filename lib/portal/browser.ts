import { chromium as playwright, type Browser } from 'playwright-core';

/**
 * ポータル自動操作用のブラウザ起動。
 * - Vercel / Lambda 上: @sparticuz/chromium が同梱する Chromium を使う
 * - ローカル: PORTAL_CHROME_PATH があればそれを、無ければインストール済み Chrome (channel) を使う
 */

/** 最後に起動したときの動かし方（失敗の記録に付ける） */
let lastMode = '';
export function lastLaunchMode(): string {
  return lastMode;
}

/** 起動したブラウザでページを開けるか、すぐに確かめる */
async function healthy(browser: Browser): Promise<boolean> {
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ok = (await page.evaluate(() => 1 + 1)) === 2;
    await ctx.close();
    return ok;
  } catch {
    return false;
  }
}

async function launchServerless(args: string[]): Promise<Browser> {
  const chromium = (await import('@sparticuz/chromium')).default;
  // 同じサーバーで別の処理が /tmp/chromium を書き出している最中だと
  // spawn ETXTBSY で失敗することがあるので、少し待って数回やり直す
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const executablePath = await chromium.executablePath();
      return await playwright.launch({ args, executablePath, headless: true });
    } catch (e) {
      lastError = e;
      if (!/ETXTBSY|EBUSY/.test((e as Error).message ?? '')) throw e;
      await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function launchBrowser(): Promise<Browser> {
  const onServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (onServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    // まずは普通の動かし方（複数プロセス）で起動する。
    // 既定の --single-process は、閉じても中身が残りやすく、使い回されたサーバーで
    // ログインの通信すら出せなくなる原因になっていた（2026-11-21/22）。
    // 起動できない・ページを開けないときだけ、既定の動かし方に戻す。
    try {
      const browser = await launchServerless(chromium.args.filter((a) => a !== '--single-process'));
      if (await healthy(browser)) {
        lastMode = '複数プロセス';
        return browser;
      }
      await browser.close().catch(() => {});
    } catch {
      // 下で既定の動かし方を試す
    }
    lastMode = '1プロセス（既定）';
    return launchServerless(chromium.args);
  }

  lastMode = 'ローカル';
  const executablePath = process.env.PORTAL_CHROME_PATH;
  if (executablePath) {
    return playwright.launch({ executablePath, headless: true });
  }
  return playwright.launch({ channel: 'chrome', headless: true });
}
