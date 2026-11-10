import type { Page } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './browser';
import { normalizeApplicationNo } from './normalize';
import { parsePortalDetail, type PortalDetail } from './detail';

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
  // 見えていても他要素に覆われている場合があるので、長く待たずに諦める
  try {
    await loc.click({ timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
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

/** 表示中の結果を識別する署名（先頭行の交付申請番号 + 行数）。年度を切り替えた際の使い回し検知用 */
async function resultSignature(page: Page): Promise<string> {
  return page
    .$$eval('table tbody tr', (trs) => {
      const first = trs[0]?.children[1] as HTMLElement | undefined;
      return `${(first?.innerText ?? '').trim()}#${trs.length}`;
    })
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
          .filter((e) => (e as HTMLElement).offsetParent !== null && e.getClientRects().length > 0)
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
async function runSearch(page: Page, fiscalYear: string, prevSignature: string): Promise<boolean> {
  // 検索条件タブへ
  await clickIfVisible(page, '検索条件', 1_000);
  await page.waitForTimeout(400);

  // 申請年度（必須）。タブ切替直後は描画が遅れることがあるので一度だけやり直す
  const yearLabel = visibleText(page, fiscalYear).first();
  try {
    await yearLabel.click({ timeout: 8_000 });
  } catch {
    await clickIfVisible(page, '検索条件', 1_000);
    await page.waitForTimeout(800);
    try {
      await yearLabel.click({ timeout: 8_000 });
    } catch {
      await debugShot(page, `search-${fiscalYear}-year-missing`);
      throw new PortalError(`申請年度「${fiscalYear}」を選択できませんでした`, 'list');
    }
  }
  await page.waitForTimeout(1_200);

  // 年度を選んだ時点でポータルが自動検索して結果タブに切り替わることがある。
  // 前回と同じ結果（使い回し）でなければそのまま採用する
  if (await hasVisibleRows(page)) {
    const sig = await resultSignature(page);
    if (sig && sig !== prevSignature) {
      await debugShot(page, `search-${fiscalYear}-rows`);
      return true;
    }
  }

  await debugShot(page, `search-${fiscalYear}-before`);

  // コンソーシアム全体で検索（幹事社アカウントのみ表示。無ければ通常の検索）
  // クリック後に画面が再描画されて Playwright 側の完了待ちが長引くことがあるため、
  // 短いタイムアウトで打ち切り、結果テーブルの出現確認に進む
  const wideBtn = page.locator('a, button', { hasText: /^\s*コンソーシアム全体で検索\s*$/ }).locator('visible=true').first();
  const searchBtn = page.locator('a, button', { hasText: /^\s*検索\s*$/ }).locator('visible=true').last();
  const target = (await wideBtn.isVisible().catch(() => false)) ? wideBtn : searchBtn;
  if (!(await target.isVisible().catch(() => false))) {
    // ボタンが無いのに結果が出ているなら自動検索済みとみなす
    if (await hasVisibleRows(page)) {
      await debugShot(page, `search-${fiscalYear}-rows`);
      return true;
    }
    await debugShot(page, `search-${fiscalYear}-no-button`);
    throw new PortalError(`検索ボタンが見つかりません（${fiscalYear}）`, 'list');
  }
  try {
    await target.click({ timeout: 10_000 });
  } catch {
    if (!(await hasVisibleRows(page))) {
      await target.dispatchEvent('click').catch(() => {});
    }
  }

  const deadline = Date.now() + 150_000;
  let confirmed = false;
  while (Date.now() < deadline) {
    if (await hasVisibleRows(page)) {
      await debugShot(page, `search-${fiscalYear}-rows`);
      return true;
    }
    // 「時間がかかる場合がありますが、よろしいですか？」→ はい（コンソーシアム検索時のみ出る）
    if (!confirmed && (await clickIfVisible(page, 'はい', 300))) {
      confirmed = true;
      await page.waitForTimeout(800);
      continue;
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
export type ScrapeResult = {
  rows: PortalRow[];
  /** 詳細（交付申請 確認）を読んだ案件。交付申請番号 → 内容 */
  details: Record<string, PortalDetail>;
  /** 年度単位で失敗したが全体は続行した場合のメッセージ */
  warnings: string[];
  yearsSearched: string[];
};

export type ScrapeOptions = {
  /** 一覧を取ったあと、詳細を読む交付申請番号を選ぶ（並び順に読む） */
  pickDetails?: (rows: PortalRow[]) => string[];
  /** 詳細を読むのに使ってよい時間（ミリ秒）。超えたら残りは次回 */
  detailBudgetMs?: number;
};

/** 「交付申請 確認」画面を開いて読み取る。開けなかった・別の画面だったときは null */
async function fetchDetail(page: Page, applicationNo: string): Promise<PortalDetail | null> {
  await page.goto(`${PORTAL_BASE}/IT-113/?app_id=${encodeURIComponent(applicationNo)}`, { waitUntil: 'domcontentloaded' });
  await visibleText(page, '補助金申請額合計').first().waitFor({ timeout: 15_000 }).catch(() => {});
  const { text, toolRows } = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const t = tables.find((x) => /ITツール名/.test(x.innerText) && /カテゴリー/.test(x.innerText));
    const rows = t
      ? Array.from(t.querySelectorAll('tr'))
          .slice(1)
          .map((tr) => Array.from(tr.children).map((td) => (td as HTMLElement).innerText))
      : [];
    return { text: document.body.innerText, toolRows: rows };
  });
  // 別の案件や別の画面が出ていないか（番号が本文にあるか）を確かめる
  if (!text.replace(/\s/g, '').includes(applicationNo)) return null;
  return parsePortalDetail(text, toolRows);
}

export async function scrapePortalCases(
  loginId: string,
  password: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
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
    const warnings: string[] = [];
    const yearsSearched: string[] = [];
    let rowsSeen = 0;
    let prevSignature = '';
    for (const year of years) {
      try {
        const hit = await runSearch(page, year, prevSignature);
        yearsSearched.push(year);
        if (!hit) continue;
        prevSignature = await resultSignature(page);
        const cells = await collectAllRows(page);
        rowsSeen += cells.length;
        for (const c of cells) {
          const row = toPortalRow(c, year);
          if (row && !map.has(row.application_no)) map.set(row.application_no, row);
        }
      } catch (e) {
        // 1 年度の失敗で全体を捨てない。取れた年度分は保存し、失敗は警告として残す
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`${year}: ${msg.split('\n')[0].slice(0, 200)}`);
        await debugShot(page, `search-${year}-failed`);
        // 画面状態を戻してから次の年度へ
        await clickIfVisible(page, '検索条件', 1_000).catch(() => false);
      }
    }
    if (yearsSearched.length === 0) {
      throw new PortalError(`どの年度も検索できませんでした: ${warnings.join(' / ')}`, 'list');
    }
    if (rowsSeen > 0 && map.size === 0) {
      throw new PortalError(
        '一覧は表示されましたが交付申請番号を読み取れませんでした（列順が変わった可能性）',
        'parse',
      );
    }

    // 紐付いた案件などの詳細（ツール・金額）を読む。時間を区切り、残りは次回に回す
    const rows = Array.from(map.values());
    const details: Record<string, PortalDetail> = {};
    const targets = options.pickDetails ? options.pickDetails(rows) : [];
    const deadline = Date.now() + (options.detailBudgetMs ?? 60_000);
    for (const no of targets) {
      if (Date.now() > deadline) {
        warnings.push(`詳細は時間の都合で ${Object.keys(details).length}/${targets.length}件 まで読みました（残りは次回）`);
        break;
      }
      try {
        const d = await fetchDetail(page, no);
        if (d) details[no] = d;
      } catch (e) {
        warnings.push(`詳細 ${no}: ${(e as Error).message.split('\n')[0].slice(0, 120)}`);
        await debugShot(page, `detail-${no}-failed`);
      }
    }

    // セッションを残さない
    await visibleText(page, 'ログアウト').first().click({ timeout: 5_000 }).catch(() => {});

    return { rows, details, warnings, yearsSearched };
  } finally {
    await browser.close().catch(() => {});
  }
}
