// 顧客が提出した書類の読み取り結果から、案件の情報（会社名・法人番号・代表者・所在地）を埋める。
// 社内で入れた値は上書きしない（空欄のときだけ埋める）。食い違いは書類の照合で「不備」として出る。
import { normalizeCorporateNumber } from '@/lib/portal/match';

/**
 * 会社法人等番号（12桁）から法人番号（13桁）を作る。
 * 法人番号 = 検査用数字（1桁）＋ 会社法人等番号（12桁）
 * 検査用数字 = 9 − （Σ(Pn × Qn) を 9 で割った余り）。Pn は下から n 桁目の数字、Qn は n が奇数なら 1・偶数なら 2
 */
export function corporateNumberFromCompanyNumber(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');
  if (digits.length === 13) return normalizeCorporateNumber(digits);
  if (digits.length !== 12) return null;
  let sum = 0;
  for (let n = 1; n <= 12; n++) {
    const p = Number(digits[12 - n]);
    sum += p * (n % 2 === 1 ? 1 : 2);
  }
  const check = 9 - (sum % 9);
  return `${check}${digits}`;
}

export type CaseIdentity = {
  company_name: string | null;
  corporate_number: string | null;
  representative_name: string | null;
  address: string | null;
};

type Extracted = Record<string, unknown> | null | undefined;
const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** 書類の読み取り結果（種類ごと）から、案件に入れられる値を取り出す */
export function identityFromDocuments(
  applicantType: 'corporation' | 'sole_proprietor',
  docs: {
    certificateOfHistory?: Extracted;
    taxCert1?: Extracted;
    financialStatements?: Extracted;
    idDocument?: Extracted;
    taxReturn?: Extracted;
    taxCert2?: Extracted;
  },
): CaseIdentity {
  if (applicantType === 'corporation') {
    const coh = docs.certificateOfHistory ?? null;
    return {
      company_name:
        str(coh?.company_name) ?? str(docs.taxCert1?.taxpayer_name) ?? str(docs.financialStatements?.company_name),
      corporate_number: corporateNumberFromCompanyNumber(str(coh?.company_number)),
      representative_name: str(coh?.representative_name) ?? str(docs.taxCert1?.representative),
      address: str(coh?.head_office_address) ?? str(docs.taxCert1?.taxpayer_address),
    };
  }
  return {
    company_name: null,
    corporate_number: null,
    representative_name: str(docs.idDocument?.full_name) ?? str(docs.taxReturn?.filer_name),
    address: str(docs.idDocument?.address) ?? str(docs.taxReturn?.filer_address) ?? str(docs.taxCert2?.taxpayer_address),
  };
}

/** 案件で空欄の項目だけを埋める更新内容 */
export function fillEmpty(current: Partial<CaseIdentity>, found: CaseIdentity): Partial<CaseIdentity> {
  const out: Partial<CaseIdentity> = {};
  for (const k of Object.keys(found) as Array<keyof CaseIdentity>) {
    const now = current[k];
    if ((now == null || String(now).trim() === '') && found[k]) out[k] = found[k];
  }
  return out;
}

export const IDENTITY_LABELS: Record<keyof CaseIdentity, string> = {
  company_name: '会社名',
  corporate_number: '法人番号',
  representative_name: '代表者',
  address: '所在地',
};
