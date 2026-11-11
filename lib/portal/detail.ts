// ポータルの「交付申請 確認」画面（IT-113/?app_id=<交付申請番号>）から読み取る内容（純粋関数）。
// 画面の本文を行に分けたものと、ITツールの表の行（セルの文字列）を受け取って整える。
import { normalizeCorporateNumber, roundFromPortal } from './match';

export type PortalTool = {
  tool_no: string | null; // ITツールNo（例: DL07-0021999）
  name: string; // ITツール名
  category: string | null; // カテゴリー（ソフトウェア・セキュリティなど）
  subtotal: number | null; // ITツール小計（円）
};

export type PortalDetail = {
  round: number | null;
  corporate_number: string | null;
  representative_name: string | null;
  tools: PortalTool[];
  /** 補助金申請額合計（円） */
  subsidy_requested: number | null;
  /** 補助対象経費合計（税抜き） */
  eligible_cost: number | null;
  /** 総事業費合計（税込み） */
  total_cost: number | null;
  /** 申請者の会社名（法人名・事業者名など） */
  company_name?: string | null;
  /** 申請者の住所（本店所在地。都道府県・市区町村・番地が分かれていればつなげる） */
  address?: string | null;
  /** 申請者の郵便番号 */
  postal?: string | null;
  /** 代表者役職 */
  representative_title?: string | null;
  /** 画面の「基本情報」あたりの本文（見出しの確認・読み取りの調整用。最大 3000 文字） */
  basic_text?: string | null;
  fetched_at: string;
};

/** 代表者氏名。画面では姓と名が別の行のことがあるので、次の見出し（代表者氏名（フリガナ）など）の前までをつなげる */
function representativeName(lines: string[]): string | null {
  const i = lines.findIndex((l) => l === '代表者氏名');
  if (i < 0) return null;
  const parts: string[] = [];
  for (let k = i + 1; k < lines.length && parts.length < 2; k++) {
    const l = lines[k];
    if (/^代表者|^従業員|^資本金|^設立|^業種|^電話|^メール|^申請|^基本情報|ITツール|（フリガナ）|[：:]/.test(l)) break;
    parts.push(l);
  }
  return parts.length ? parts.join(' ') : null;
}

/** いくつかの見出しのうち、最初に見つかったものの値 */
function firstValue(lines: string[], labels: string[]): string | null {
  for (const l of labels) {
    const v = valueAfter(lines, l);
    if (v && v.trim() && !/^[-ー－]$/.test(v.trim())) return v.trim();
  }
  return null;
}

const COMPANY_LABELS = ['法人名', '法人名称', '事業者名', '事業者名称', '商号', '商号又は名称', '申請者名', '名称', '屋号'];
const ADDRESS_LABELS = ['本店所在地', '本社所在地', '所在地', '住所', '事業所所在地'];
const ADDRESS_PARTS = [
  ['都道府県'],
  ['市区町村', '市区郡町村'],
  ['番地', '町名・番地', '丁目・番地', '町域・番地'],
  ['建物名', 'ビル・建物名', '建物名・部屋番号'],
];

/** 申請者の会社名・住所など（見出しの書き方の違いを吸収する） */
export function parseApplicantParty(lines: string[]) {
  let address = firstValue(lines, ADDRESS_LABELS);
  if (!address) {
    const parts = ADDRESS_PARTS.map((labels) => firstValue(lines, labels)).filter(Boolean);
    address = parts.length >= 2 ? parts.join('') : null;
  }
  const postal = firstValue(lines, ['郵便番号', '本店郵便番号'])?.replace(/[^0-9０-９-－]/g, '') || null;
  return {
    company_name: firstValue(lines, COMPANY_LABELS),
    address,
    postal,
    representative_title: firstValue(lines, ['代表者役職', '代表者の役職']),
  };
}

/** "3,089,333円" → 3089333 */
export function parseYen(v: string | null | undefined): number | null {
  if (!v) return null;
  const s = v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円]/g, '');
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/** ラベルの行の次の行（値）を返す。ラベルは完全一致で探す */
function valueAfter(lines: string[], label: string): string | null {
  const i = lines.findIndex((l) => l === label);
  if (i < 0 || i + 1 >= lines.length) return null;
  return lines[i + 1];
}

/**
 * @param text 画面の本文（innerText）
 * @param toolRows ITツールの表の行。各行はセルの innerText の配列（見出し行は除く）
 */
export function parsePortalDetail(text: string, toolRows: string[][], fetchedAt = new Date().toISOString()): PortalDetail {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const tools: PortalTool[] = [];
  for (const cells of toolRows) {
    // 0: "ITツールNo\nツール管理コード"  1: "ITツール名\nカテゴリー"  6: ITツール小計（円）
    const [no] = (cells[0] ?? '').split('\n').map((s) => s.trim());
    const nameCat = (cells[1] ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!nameCat[0]) continue;
    const subtotalCell = (cells[6] ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    tools.push({
      tool_no: no || null,
      name: nameCat[0],
      category: nameCat[1] ?? null,
      subtotal: parseYen(subtotalCell[subtotalCell.length - 1]),
    });
  }

  return {
    round: roundFromPortal(valueAfter(lines, '募集回')),
    corporate_number: normalizeCorporateNumber(valueAfter(lines, '法人番号')),
    representative_name: representativeName(lines),
    tools,
    subsidy_requested: parseYen(valueAfter(lines, '補助金申請額合計')),
    eligible_cost: parseYen(valueAfter(lines, '補助対象経費合計（税抜き）')),
    total_cost: parseYen(valueAfter(lines, '総事業費合計（税込み）')),
    ...parseApplicantParty(lines),
    basic_text: basicText(lines),
    fetched_at: fetchedAt,
  };
}

/** 記録した「基本情報」の本文から、申請者の会社名・住所・代表者を読み直す（読み取り方を直したときに、同期を待たずに効かせる） */
export function partyFromBasicText(text: string | null | undefined) {
  if (!text) return null;
  const lines = text.split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean);
  return { ...parseApplicantParty(lines), representative_name: representativeName(lines) };
}

/** 「基本情報」から ITツールの前までの本文（無ければ先頭から） */
function basicText(lines: string[]): string | null {
  const start = Math.max(0, lines.findIndex((l) => l === '基本情報'));
  const endIdx = lines.findIndex((l, i) => i > start && /ITツール/.test(l));
  const slice = lines.slice(start, endIdx > start ? endIdx : start + 80);
  const t = slice.join('\n').slice(0, 3000);
  return t || null;
}

/** ツール名から、ツールマスタ（BU・LU など）の該当を探す。名前・頭文字のどちらかが含まれていれば一致 */
export function matchToolMaster<T extends { id: string; code: string; name: string }>(
  portalTools: PortalTool[],
  masters: T[],
): T | null {
  const norm = (s: string) => s.replace(/[\s　]/g, '').toLowerCase();
  for (const t of portalTools) {
    const n = norm(t.name);
    const hit = masters.find((m) => {
      const name = norm(m.name);
      // 頭文字（2〜3文字）だけの名前は誤一致しやすいので、名前が4文字以上のときだけ名前で照合する
      return name.length >= 4 && (n.includes(name) || name.includes(n));
    });
    if (hit) return hit;
  }
  return null;
}
