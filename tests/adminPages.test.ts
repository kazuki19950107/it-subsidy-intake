import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_PAGES } from '@/lib/admin/pages';

// 管理画面を追加したのに lib/admin/pages.ts（メニューと「使い方」ページの元）に
// 足し忘れていないかを確かめる。失敗したら pages.ts に追加し、使い方ページの説明も更新すること。

const SECURE = path.resolve(__dirname, '../app/admin/(secure)');

/** app/admin/(secure) 配下の page.tsx から URL を集める（動的な [id] のページは除く） */
function adminRoutes(dir = SECURE, prefix = '/admin'): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('[')) continue;
    const sub = path.join(dir, e.name);
    const href = `${prefix}/${e.name}`;
    if (fs.existsSync(path.join(sub, 'page.tsx'))) out.push(href);
    out.push(...adminRoutes(sub, href));
  }
  return out;
}

describe('管理画面の一覧', () => {
  it('すべての管理画面が lib/admin/pages.ts に登録されている', () => {
    const registered = new Set(ADMIN_PAGES.map((p) => p.href));
    const missing = adminRoutes().filter((r) => !registered.has(r));
    expect(missing).toEqual([]);
  });
  it('説明が空のページがない', () => {
    expect(ADMIN_PAGES.filter((p) => !p.description.trim()).map((p) => p.href)).toEqual([]);
  });
});
