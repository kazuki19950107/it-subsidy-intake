import type { Page } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './browser';
import { normalizeApplicationNo } from './normalize';

export { normalizeApplicationNo };

export const PORTAL_BASE = 'https://console.it-shien.smrj.go.jp';
export const PORTAL_LOGIN_URL = `${PORTAL_BASE}/IT-01/`;
export const PORTAL_LIST_URL = `${PORTAL_BASE}/IT-105/?is_new=true`;

export type PortalRow = {
  application_no: string;
  applicant_name: string | null;
  prefecture: string | null;
  round: string | null;
  application_type: string | null;
  status: string | null;
  status_updated_on: string | null; // YYYY-MM-DD
  handler_name: string | null;
  raw: string[];
  fiscal_year: string | null; // 検索した申請年度（例: 2026年度）
};

export class PortalError extends Error {
  constructor(
    message: string,
    public readonly stage: 'login' | 'list' | 'parse' | 'browser',
  ) {
    super(message);
    this.name = 'PortalError';
  }
}

/** ローカル実行時のみ、各段階のスクリーンショットと本文を保存する（原因調査用） */
const DEBUG_DIR =
  process.env.PORTAL_DEBUG_DIR ??
  (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? null : join(tmpdir(), 'portal-debug'));

async function debugShot(page: Page, name: string) {
  if (!DEBUG_DIR) return;
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    const base = join(DEBUG_DIR, `${Date.now()}-${name}`);
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    const text = await page.locator('body').innerText().catch(() => '');
    await writeFile(`${base}.txt`, `${page.url()}\n\n${text}`, 'utf8');
  } catch {
    // 調査用なので失敗しても無視
  }
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(\d{4})[/年.-](\d{1,2})[/月.-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function clean(v: string | undefined): string | null {
  const s = (v ?? '').replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text, { exact: typeof text === 'string' }).locator('visible=true');
}

async function clickIfVisible(page: Page, text: string | RegExp, timeout = 1_500): Promise<boolean> {
  const loc = visibleText(page, text).first();
  const visible = await loc.isVisible({ timeout }).catch(() => false);
  if (!visible) return false;
  await loc.click();
  return true;
}

/** 一覧テーブルの行を読み取る。列順は 2026 年度ポータルの表示順に依存。 */
async function readRows(page: Page): Promise<string[][]> {
  return page.$$eval('table tbody tr', (trs) =>
    trs.map((tr) => Array.from(tr.children).map((td) => (td as HTMLElement).innerText ?? '')),
  );
}

async function firstRowNo(page: Page): Promise<string> {
  return page
    .$eval('table tbody tr td', (td) => ((td as HTMLElement).innerText ?? '').trim())
    .catch(() => '');
}

async function hasVisibleRows(page: Page): Promise<boolean> {
  const rows = page.locator('table tbody tr');
  if ((await rows.count()) === 0) return false;
  return rows.first().isVisible().catch(() => false);
}

// ---------------------------------------------------------------- login

async function login(page: Page, loginId: string, password: string) {
  await page.goto(PORTAL_LOGIN_URL, { waitUntil: 'domcontentloaded' });
  const idInput = page.locator('input[type="text"]').first();
  const pwInput = page.locator('input[type="password"]').first();
  await idInput.waitFor({ state: 'visible', timeout: 30_000 });
  await idInput.fill(loginId);
  await pwInput.fill(password);

  await debugShot(page, 'login-filled');
  // ヘッダーにも「ログイン」リンクがあるため、フォーム下のボタン（DOM 上で後ろ）を押す
  await visibleText(page, 'ログイン').last().click();

  // ログイン成功 = ログアウトボタンが出る / URL が IT-01 から離れる
  try {
    await Promise.race([
      page.waitForURL((u) => !u.pathname.startsWith('/IT-01'), { timeout: 30_000 }),
      visibleText(page, 'ログアウト').first().waitFor({ timeout: 30_000 }),
    ]);
  } catch {
    await debugShot(page, 'login-failed');
    const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? '';
    const hint =
      bodyText.match(/[^\n]*(誤り|正しく|ロック|無効|失敗|エラー)[^\n]*/)?.[0]?.trim() ??
      'ログイン後の画面に遷移しませんでした';
    throw new PortalError(`ポータルにログインできません: ${hint}`, 'login');
  }
  await debugShot(page, 'login-ok');
}

// ---------------------------------------------------------------- navigation

const onListPage = (page: Page) => /\/IT-10\d/.test(new URL(page.url()).pathname);

/**
 * 一覧へはメニュー経由で遷移する。URL を直接開くと SPA のセッションが失われ
 * ログイン画面に戻されるため（2026-09 時点の挙動）。
 */
async function navigateToList(page: Page) {
  const menu = visibleText(page, '交付申請関連').first();
  const item = visibleText(page, '交付申請検索').first();

  for (let attempt = 0; attempt < 3 && !(await item.isVisible().catch(() => false)); attempt++) {
    if (attempt === 0) await menu.hover().catch(() => {});
    else await menu.click().catch(() => {});
    await page.waitForTimeout(700);
  }

  if (await item.isVisible().catch(() => false)) {
    // ドロップダウンが閉じていると他要素にクリックを奪われるため、段階的に強めていく
    await menu.hover().catch(() => {});
    await page.waitForTimeout(500);
    await item.click({ timeout: 5_000 }).catch(() => {});
    if (!onListPage(page)) {
      await page.waitForTimeout(1_000);
      if (!onListPage(page)) await item.click({ force: true, timeout: 5_000 }).catch(() => {});
    }
    if (!onListPage(page)) {
      await page.waitForTimeout(1_000);
      if (!onListPage(page)) await item.dispatchEvent('click').catch(() => {});
    }
    await page.waitForURL((u) => /\/IT-10\d/.test(u.pathname), { timeout: 20_000 }).catch(() => {});
  } else {
    // メニューが見つからなければ直接遷移を試す（セッションが保たれる場合もある）
    await page.goto(PORTAL_LIST_URL, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForTimeout(1_500);
  await debugShot(page, 'list-opened');
  if (/\/IT-01\/?$/.test(new URL(page.url()).pathname)) {
    throw new PortalError('一覧へ遷移した時点でログイン画面に戻されました', 'list');
  }
  if (!onListPage(page)) {
    throw new PortalError('交付申請検索の画面に遷移できませんでした（メニュー構成が変わった可能性）', 'list');
  }
}

// ---------------------------------------------------------------- search

/** 検索条件タブに表示されている「20XX年度」ラベルを新しい順に返す */
async function listFiscalYears(page: Page): Promise<string[]> {
  await clickIfVisible(page, '検索条件', 1_000);
  await page.waitForTimeout(300);
  const labels = await page.$$eval('label, span, div', (els) =>
    Array.from(
      new Set(
        els
          .map((e) => (e.textContent ?? '').trim())
          .filter((t) => /^\d{4}年度$/.test(t)),
      ),
    ),
  );
  return labels.sort().reverse();
}

const NO_HIT_RE =
  /検索条件を満たす.*(ありません|存在しません)|該当(する|の)?(データ|案件|情報|申請)?(が|は)?(ありません|存在しません|見つかりません)|検索結果(が|は)(ありません|0件)/;

/**
 * 指定年度で「コンソーシアム全体で検索」を実行し、結果テーブルが出るまで待つ。
 * 0 件のときは false。
 */
async function runSearch(page: Page, fiscalYear: string): Promise<boolean> {
  // 検索条件タブへ
  await clickIfVisible(page, '検索条件', 1_000);
  await page.waitForTimeout(400);

  // 申請年度（必須）
  await visibleText(page, fiscalYear).first().click();
  await page.waitForTimeout(200);

  await debugShot(page, `search-${fiscalYear}-before`);

  // コンソーシアム全体で検索（無ければ通常の検索）
  const wide = visibleText(page, 'コンソーシアム全体で検索').first();
  if (await wide.isVisible().catch(() => false)) {
    await wide.click();
  } else {
    await visibleText(page, '検索').last().click();
  }

  const deadline = Date.now() + 150_000;
  let confirmed = false;
  while (Date.now() < deadline) {
    // 「時間がかかる場合がありますが、よろしいですか？」→ はい
    if (!confirmed && (await clickIfVisible(page, 'はい', 300))) {
      confirmed = true;
      await page.waitForTimeout(800);
      continue;
    }
    if (await hasVisibleRows(page)) {
      await debugShot(page, `search-${fiscalYear}-rows`);
      return true;
    }
    // 結果タブが自動で開かない場合に備える
    const resultTab = visibleText(page, '検索結果').first();
    if (await resultTab.isVisible().catch(() => false)) {
      await resultTab.click().catch(() => {});
      await page.waitForTimeout(500);
      if (await hasVisibleRows(page)) {
        await debugShot(page, `search-${fiscalYear}-rows`);
        return true;
      }
    }
    // 必須未入力などの入力エラー
    const formError = await visibleText(page, /必須項目です|すべての項目を入力してください/)
      .first()
      .isVisible()
      .catch(() => false);
    if (formError) {
      await debugShot(page, `search-${fiscalYear}-form-error`);
      throw new PortalError(`検索条件の入力エラー（${fiscalYear}）: 画面構成が変わった可能性`, 'list');
    }
    const noHit = await visibleText(page, NO_HIT_RE).first().isVisible().catch(() => false);
    if (noHit) {
      await debugShot(page, `search-${fiscalYear}-empty`);
      return false;
    }
    await page.waitForTimeout(1_000);
  }
  await debugShot(page, `search-${fiscalYear}-timeout`);
  throw new PortalError(
    `検索結果が表示されませんでした（${fiscalYear}）${DEBUG_DIR ? ` 調査用画像: ${DEBUG_DIR}` : ''}`,
    'list',
  );
}

/** ページ番号リンク（1,2,3...）を辿って全行を集める。ページ送りは画面内切替で通信なし。 */
async function collectAllRows(page: Page): Promise<string[][]> {
  const all: string[][] = [];
  const first = await readRows(page);
  if (first.length === 0) return all;
  all.push(...first);

  const pageNumbers = await page.$$eval('a', (as) =>
    Array.from(
      new Set(
        as
          .filter((a) => (a as HTMLElement).offsetParent !== null)
          .map((a) => (a.textContent ?? '').trim())
          .filter((t) => /^\d+$/.test(t))
          .map((t) => Number(t)),
      ),
    ).sort((a, b) => a - b),
  );

  for (const n of pageNumbers) {
    if (n <= 1) continue;
    const before = await firstRowNo(page);
    await page
      .locator('a', { hasText: new RegExp(`^${n}$`) })
      .locator('visible=true')
      .first()
      .click();
    // 先頭行の No. が変わるまで待つ
    await page
      .waitForFunction(
        (prev) => {
          const td = document.querySelector('table tbody tr td');
          return td && (td as HTMLElement).innerText.trim() !== prev;
        },
        before,
        { timeout: 15_000 },
      )
      .catch(() => {});
    all.push(...(await readRows(page)));
  }
  return all;
}

function toPortalRow(cells: string[], fiscalYear: string): PortalRow | null {
  // 0:No. 1:交付申請番号 2:申請者名 3:都道府県 4:募集回 5:申請枠・申請類型 6:ステータス 7:ステータス最終更新日 8:担当事業者名
  const no = normalizeApplicationNo(cells[1]);
  if (!no || !/^[A-Z]{2,4}\d{2}-\d{5,}$/.test(no)) return null;
  return {
    application_no: no,
    applicant_name: clean(cells[2]),
    prefecture: clean(cells[3]),
    round: clean(cells[4]),
    application_type: clean(cells[5]),
    status: clean(cells[6]),
    status_updated_on: parseDate(clean(cells[7])),
    handler_name: clean(cells[8]),
    raw: cells.map((c) => c.replace(/\s+/g, ' ').trim()),
    fiscal_year: fiscalYear,
  };
}

// ---------------------------------------------------------------- main

/**
 * ポータルにログインし、「保存済交付申請検索」を申請年度ごとに
 * 「コンソーシアム全体で検索」して全件を取得する。交付申請番号で重複排除済み。
 */
export async function scrapePortalCases(loginId: string, password: string): Promise<PortalRow[]> {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    throw new PortalError(`ブラウザを起動できません: ${(e as Error).message}`, 'browser');
  }
  try {
    const context = await browser.newContext({
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      viewport: { width: 1400, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    await login(page, loginId, password);
    await navigateToList(page);

    const years = await listFiscalYears(page);
    if (years.length === 0) {
      throw new PortalError('検索条件に申請年度が見つかりません（画面構成が変わった可能性）', 'list');
    }

    const map = new Map<string, PortalRow>();
    let rowsSeen = 0;
    for (const year of years) {
      const hit = await runSearch(page, year);
      if (!hit) continue;
      const cells = await collectAllRows(page);
      rowsSeen += cells.length;
      for (const c of cells) {
        const row = toPortalRow(c, year);
        if (row && !map.has(row.application_no)) map.set(row.application_no, row);
      }
    }
    if (rowsSeen > 0 && map.size === 0) {
      throw new PortalError(
        '一覧は表示されましたが交付申請番号を読み取れませんでした（列順が変わった可能性）',
        'parse',
      );
    }

    // セッションを残さない
    await visibleText(page, 'ログアウト').first().click({ timeout: 5_000 }).catch(() => {});

    return Array.from(map.values());
  } finally {
    await browser.close().catch(() => {});
  }
}
