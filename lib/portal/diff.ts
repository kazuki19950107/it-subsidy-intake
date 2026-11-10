import { normalizeCorporateNumber, normalizeName } from './match';

export type PortalStatusChange = {
  application_no: string;
  applicant_name: string | null;
  from: string | null;
  to: string | null;
  /** 前回の取得に無かった（初めて見た）案件 */
  isNew: boolean;
};

/**
 * 前回の取得結果（申請番号→状態）と今回の取得結果を比べ、状態が変わったもの・新しく出てきたものを返す。
 * 今回の取得に無くなった案件は「変化」とはみなさない（年度の取得失敗などで一時的に消えることがあるため）。
 */
export function diffPortalRows(
  previous: Map<string, string | null>,
  rows: Array<{ application_no: string; applicant_name: string | null; status: string | null }>,
): PortalStatusChange[] {
  const out: PortalStatusChange[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.application_no)) continue;
    seen.add(r.application_no);
    if (!previous.has(r.application_no)) {
      out.push({ application_no: r.application_no, applicant_name: r.applicant_name, from: null, to: r.status, isNew: true });
      continue;
    }
    const before = previous.get(r.application_no) ?? null;
    if ((before ?? '') !== (r.status ?? '')) {
      out.push({ application_no: r.application_no, applicant_name: r.applicant_name, from: before, to: r.status, isNew: false });
    }
  }
  return out;
}

export type MatchableCase = {
  id: string;
  portal_application_no: string | null;
  corporate_number: string | null;
  company_name: string | null;
  applicant_name?: string | null;
};

export type PortalMatch =
  | { kind: 'application_no'; caseId: string }
  | { kind: 'corporate_number'; caseId: string }
  | { kind: 'name_candidates'; caseIds: string[] }
  | { kind: 'none' };

/** ポータルの行（生データ）から 13 桁の法人番号らしき値を探す */
export function corporateNumberFromRaw(raw: unknown): string | null {
  const cells: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { cells?: unknown }).cells)
      ? ((raw as { cells: unknown[] }).cells)
      : [];
  for (const c of cells) {
    if (typeof c !== 'string') continue;
    const m = c.replace(/[-\s]/g, '').match(/(?<!\d)(\d{13})(?!\d)/);
    if (m) return normalizeCorporateNumber(m[1]);
  }
  return null;
}

/**
 * ポータルの 1 行を案件に照合する。申請番号 → 法人番号 → 正規化した会社名 の順。
 * 会社名での一致は候補を返すだけ（確定は人が行う）。
 */
export function matchPortalRow(
  row: { application_no: string; applicant_name: string | null; corporate_number?: string | null },
  cases: MatchableCase[],
): PortalMatch {
  const byNo = cases.find((c) => c.portal_application_no === row.application_no);
  if (byNo) return { kind: 'application_no', caseId: byNo.id };

  const corp = normalizeCorporateNumber(row.corporate_number ?? null);
  if (corp) {
    // 申請番号が未設定の案件だけを対象にする（別の申請番号が付いた案件を上書きしない）
    const hits = cases.filter(
      (c) => !c.portal_application_no && normalizeCorporateNumber(c.corporate_number) === corp,
    );
    if (hits.length === 1) return { kind: 'corporate_number', caseId: hits[0].id };
  }

  const target = normalizeName(row.applicant_name);
  if (target.length >= 2) {
    const ids = cases
      .filter((c) => !c.portal_application_no)
      .filter((c) => [c.company_name, c.applicant_name].some((n) => normalizeName(n) === target))
      .map((c) => c.id);
    if (ids.length > 0) return { kind: 'name_candidates', caseIds: ids };
  }
  return { kind: 'none' };
}
