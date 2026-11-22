import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { freemem } from 'node:os';
import { join } from 'node:path';

/**
 * ブラウザを起動する前の片付け（Vercel 上だけ）。
 *
 * Vercel は同じサーバーを次の呼び出しにも使い回す。ブラウザ（--single-process で動く Chromium）は
 * 閉じても中身が残ることがあり、残りがたまると、ログインの通信すら出せなくなる
 * （net::ERR_INSUFFICIENT_RESOURCES・ログイン後の画面に進まない。2026-11-21/22 の記録）。
 * 同期は同時に 1 社だけ（sync.ts の acquireSyncSlot）なので、起動前に残っているブラウザは
 * すべて前回の残りとみなして止め、一時ファイルも消す。
 */

/** このサーバー（プロセス）でブラウザを起動した回数 */
let launches = 0;

export type ServerState = {
  launchNo: number;
  killed: number;
  tmpMb: number;
  freeMemMb: number;
  fds: number;
};

async function dirSizeMb(dir: string): Promise<number> {
  let total = 0;
  const walk = async (d: string, depth: number) => {
    if (depth > 6) return;
    const entries = await readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else total += (await stat(p).catch(() => ({ size: 0 }))).size;
    }
  };
  await walk(dir, 0);
  return Math.round(total / 1_048_576);
}

/** 前回の残りのブラウザを止める。止めた数を返す */
async function killLeftoverBrowsers(): Promise<number> {
  const pids = await readdir('/proc').catch(() => [] as string[]);
  let killed = 0;
  for (const pid of pids) {
    if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
    const cmd = await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
    if (!/chrom/i.test(cmd)) continue;
    try {
      process.kill(Number(pid), 'SIGKILL');
      killed++;
    } catch {
      // すでに終わっている
    }
  }
  return killed;
}

/** ブラウザが作る一時フォルダを消す（/tmp/chromium など、起動に使うファイルは残す） */
async function cleanTmp(): Promise<void> {
  const entries = await readdir('/tmp').catch(() => [] as string[]);
  for (const name of entries) {
    if (/^(playwright_chromiumdev_profile-|playwright-artifacts-|\.org\.chromium\.|core\.)/.test(name)) {
      await rm(join('/tmp', name), { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** 起動の前に片付けて、サーバーの様子を返す（失敗したときの記録に使う） */
export async function prepareServer(): Promise<ServerState> {
  launches++;
  const onServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  let killed = 0;
  if (onServerless) {
    killed = await killLeftoverBrowsers();
    if (killed > 0) await new Promise((r) => setTimeout(r, 500));
    await cleanTmp();
  }
  return {
    launchNo: launches,
    killed,
    tmpMb: onServerless ? await dirSizeMb('/tmp') : 0,
    freeMemMb: Math.round(freemem() / 1_048_576),
    fds: (await readdir('/proc/self/fd').catch(() => [])).length,
  };
}

/** 失敗の記録に付ける 1 行（まとめの LINE には出ない。2 行目に置くため） */
export function describeServer(s: ServerState): string {
  return `診断: このサーバーで${s.launchNo}回目の起動・残っていたブラウザ${s.killed}個を停止・/tmp ${s.tmpMb}MB・空きメモリ${s.freeMemMb}MB・開いているファイル${s.fds}`;
}
