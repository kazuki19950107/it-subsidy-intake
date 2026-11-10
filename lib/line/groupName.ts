import { normalizeName, toHalfWidth } from '@/lib/portal/match';

export type ParsedGroupName = {
  round: number | null;
  toolCode: string | null;
  companyName: string | null;
};

/**
 * グループLINEの名前から回次・ツールの頭文字・会社名を読み取る。
 * 例: `３次BU×MEM株式会社様` → { round: 3, toolCode: 'BU', companyName: 'MEM株式会社' }
 * 形が崩れていても、読み取れた部分だけ返す。
 */
export function parseGroupName(name: string | null | undefined): ParsedGroupName {
  const empty: ParsedGroupName = { round: null, toolCode: null, companyName: null };
  if (!name) return empty;
  const s = toHalfWidth(name).trim();

  // 「3次BU×会社名様」（区切りは × / x / X / ＊ / *）
  const m = s.match(/^(\d+)\s*次\s*([A-Za-z]+)?\s*[×xX*＊]\s*(.+)$/);
  if (m) {
    return {
      round: Number(m[1]),
      toolCode: m[2] ? m[2].toUpperCase() : null,
      companyName: cleanCompany(m[3]),
    };
  }
  // 「BU×会社名様」（回次なし）
  const m2 = s.match(/^([A-Za-z]+)\s*[×xX*＊]\s*(.+)$/);
  if (m2) {
    return { round: null, toolCode: m2[1].toUpperCase(), companyName: cleanCompany(m2[2]) };
  }
  // 区切りが無い場合は名前全体を会社名とみなす
  return { ...empty, companyName: cleanCompany(s) };
}

function cleanCompany(v: string): string | null {
  const c = v.trim().replace(/\s*(様|御中|さま)+\s*$/g, '').trim();
  return c === '' ? null : c;
}

export type GroupMatchCase = {
  id: string;
  company_name: string | null;
  round: number | null;
  tool_code: string | null;
};

export type GroupMatchResult = {
  /** 1 件に絞れたときの案件 ID */
  matchedId: string | null;
  /** 候補（会社名が一致・類似するもの。良い順） */
  candidateIds: string[];
};

function score(parsed: ParsedGroupName, c: GroupMatchCase): number {
  const target = normalizeName(parsed.companyName);
  const name = normalizeName(c.company_name);
  if (!target || !name) return 0;
  let s = 0;
  if (target === name) s = 100;
  else if (target.length >= 3 && name.length >= 3 && (target.includes(name) || name.includes(target))) s = 50;
  else return 0;
  if (parsed.round != null && c.round != null) s += parsed.round === c.round ? 20 : -40;
  if (parsed.toolCode && c.tool_code) s += parsed.toolCode === c.tool_code.toUpperCase() ? 20 : -40;
  return s;
}

/**
 * グループ名から案件を探す。会社名の一致を基本に、回次・ツールが合えば加点、食い違えば減点。
 * 最高点が 1 件だけ（かつ会社名が完全一致）なら自動で紐付ける。
 */
export function matchCasesForGroup(parsed: ParsedGroupName, cases: GroupMatchCase[]): GroupMatchResult {
  const scored = cases
    .map((c) => ({ id: c.id, s: score(parsed, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return { matchedId: null, candidateIds: [] };
  const top = scored[0].s;
  const tops = scored.filter((x) => x.s === top);
  const matchedId = tops.length === 1 && top >= 100 ? tops[0].id : null;
  return { matchedId, candidateIds: scored.slice(0, 10).map((x) => x.id) };
}

/**
 * グループ内の会話から候補を絞る。発言に会社名（正規化後）が含まれる候補だけを残す。
 * 1 件になれば紐付け先として返す。
 */
export function narrowByMessage(
  text: string,
  candidates: Array<{ id: string; company_name: string | null }>,
): string | null {
  const t = normalizeName(text);
  if (!t) return null;
  const hits = candidates.filter((c) => {
    const n = normalizeName(c.company_name);
    return n.length >= 2 && t.includes(n);
  });
  return hits.length === 1 ? hits[0].id : null;
}
