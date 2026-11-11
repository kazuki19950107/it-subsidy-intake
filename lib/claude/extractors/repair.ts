import type { z } from 'zod';

// AI（Claude）の答えが決めた形（zod のスキーマ）に少し合わないとき、できるだけ直して受け取る（純粋関数）。
// 例: 納税証明書の「その3の3」→「その3」、金額の "1,234円" → 1234、抜けた項目 → null。
// 直せないところは null / "unknown" にして、書類の判定（不備・担当者確認）に任せる。「解析失敗」にはしない。

type Json = unknown;

/** 全角の英数字・空白をそろえる */
export function normalizeText(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .trim();
}

/** 選択肢に近いものを選ぶ（完全一致 → 前方一致の長いもの → 含む → unknown → null） */
export function closestOption(received: unknown, options: readonly string[]): string | null {
  if (typeof received !== 'string') return options.includes('unknown') ? 'unknown' : null;
  const r = normalizeText(received);
  const norm = options.map((o) => [o, normalizeText(o)] as const);
  const exact = norm.find(([, n]) => n === r);
  if (exact) return exact[0];
  const prefix = norm
    .filter(([o, n]) => o !== 'unknown' && n && r.startsWith(n))
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (prefix) return prefix[0];
  const inside = norm.filter(([o, n]) => o !== 'unknown' && n && r.includes(n)).sort((a, b) => b[1].length - a[1].length)[0];
  if (inside) return inside[0];
  return options.includes('unknown') ? 'unknown' : null;
}

/** "1,234円" → 1234。数にできなければ null */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = normalizeText(v).replace(/[,，円¥￥]/g, '');
  const m = s.match(/^[-−]?\d+(\.\d+)?$/);
  return m ? Number(s.replace('−', '-')) : null;
}

function getAt(obj: Json, path: (string | number)[]): Json {
  let cur = obj as Record<string | number, Json> | undefined;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, Json>)[k] as Record<string | number, Json> | undefined;
  }
  return cur;
}

function setAt(obj: Json, path: (string | number)[], value: Json): void {
  if (path.length === 0) return;
  let cur = obj as Record<string | number, Json>;
  for (const k of path.slice(0, -1)) {
    if (cur[k] == null || typeof cur[k] !== 'object') return;
    cur = cur[k] as Record<string | number, Json>;
  }
  cur[path[path.length - 1]] = value;
}

const REMOVE = Symbol('remove');

/** 1 つの不一致を直した値を返す（REMOVE なら配列から取り除く） */
function fixIssue(issue: z.ZodIssue, current: Json): Json | typeof REMOVE {
  if (issue.code === 'invalid_enum_value') {
    const v = closestOption(current, issue.options.map(String));
    // 配列の中の選択肢（例: 決算書の書類の種類）で合うものが無ければ、その要素を取り除く
    if (v === null && typeof issue.path[issue.path.length - 1] === 'number') return REMOVE;
    return v;
  }
  if (issue.code === 'invalid_type') {
    if (issue.expected === 'number') return toNumber(current);
    if (issue.expected === 'string') {
      if (typeof current === 'number' || typeof current === 'boolean') return String(current);
      return null;
    }
    if (issue.expected === 'array') return [];
    if (issue.expected === 'boolean') {
      if (typeof current === 'string') return /^(true|はい|有|あり|yes)$/i.test(current.trim());
      return null;
    }
    return null;
  }
  return null;
}

/**
 * スキーマに合うまで直して返す（最大 5 回）。直しきれなければ、最後の結果と一緒にエラーを投げる。
 * 直したところは repaired に入れて返す（ログ・調査用）。
 */
export function parseLenient<S extends z.ZodTypeAny>(schema: S, input: Json): { data: z.output<S>; repaired: string[] } {
  const value = JSON.parse(JSON.stringify(input ?? {})) as Json;
  const repaired: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = schema.safeParse(value);
    if (r.success) return { data: r.data, repaired };
    // 配列から取り除くものは、添字がずれないよう後ろから
    const issues = [...r.error.issues].sort((a, b) => {
      const ai = a.path[a.path.length - 1];
      const bi = b.path[b.path.length - 1];
      return typeof ai === 'number' && typeof bi === 'number' ? bi - ai : 0;
    });
    let changed = false;
    for (const issue of issues) {
      if (issue.path.length === 0) continue;
      const cur = getAt(value, issue.path);
      const next = fixIssue(issue, cur);
      if (next === REMOVE) {
        const parent = getAt(value, issue.path.slice(0, -1));
        if (Array.isArray(parent)) {
          parent.splice(issue.path[issue.path.length - 1] as number, 1);
          changed = true;
          repaired.push(`${issue.path.join('.')}: ${JSON.stringify(cur)} → 削除`);
        }
        continue;
      }
      if (JSON.stringify(next) !== JSON.stringify(cur)) {
        setAt(value, issue.path, next);
        changed = true;
        repaired.push(`${issue.path.join('.')}: ${JSON.stringify(cur)} → ${JSON.stringify(next)}`);
      }
    }
    if (!changed) break;
  }
  // 直しきれないときは、元のエラーの形で投げる
  return { data: schema.parse(value), repaired };
}
