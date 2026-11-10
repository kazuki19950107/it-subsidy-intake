import { daysSince } from '@/lib/utils/dateCheck';
import { DOC_TYPE_LABELS } from '@/lib/claude/docTypes';
import {
  validateFinancialStatements,
  type FinancialStatementsData,
} from '@/lib/claude/extractors/financialStatements';
import type { DocType } from '@/lib/supabase/types';
import { DEFAULT_DOC_RULES, type DocRules } from '@/lib/docRules/defaults';
import { normalizeCorporateNumber, normalizeName as normalizeForMatch } from '@/lib/portal/match';

/** 案件に登録済みの会社情報（書類の内容と照らし合わせる） */
export type RegisteredCompany = {
  company_name?: string | null;
  corporate_number?: string | null;
};

export type CrossCheckOptions = {
  rules?: DocRules;
  registered?: RegisteredCompany | null;
};

/** 写真の四隅チェック結果を validation_errors に格納するときの field 名 */
export const PHOTO_CORNERS_FIELD = 'photo_corners';

export type CrossCheckResult = {
  level: 'error' | 'warning' | 'info';
  field: string;
  message: string;
};

type ExtractedDocs = {
  certificateOfHistory?: {
    company_number?: string | null;
    company_name?: string | null;
    issued_date?: string | null;
    representative_name?: string | null;
    head_office_address?: string | null;
  } | null;
  taxCert1?: {
    certificate_type?: string | null;
    tax_category?: string | null;
    taxpayer_name?: string | null;
    representative?: string | null;
    taxpayer_address?: string | null;
  } | null;
  taxCert2?: {
    certificate_type?: string | null;
    tax_category?: string | null;
    taxpayer_name?: string | null;
    taxpayer_address?: string | null;
  } | null;
  financialStatements?: Partial<FinancialStatementsData> | null;
  idDocument?: {
    doc_type?: string | null;
    full_name?: string | null;
    address?: string | null;
    expiration_date?: string | null;
    issued_date?: string | null;
    has_front?: boolean;
    has_back?: boolean;
  } | null;
  taxReturn?: {
    filer_name?: string | null;
    filer_address?: string | null;
    e_tax_timestamp?: string | null;
    office_stamp_detected?: boolean;
    tax_year?: string | null;
  } | null;
  blueForm?: {
    filing_type?: string | null;
    tax_year?: string | null;
    net_income?: number | null;
  } | null;
  eTaxReceipt?: {
    receipt_datetime?: string | null;
    submitter_name?: string | null;
  } | null;
};

function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/株式会社|（株）|\(株\)|有限会社|（有）|\(有\)/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
}

function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\s|　/g, '').toLowerCase();
}

function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return '';
  return addr.replace(/\s|　|丁目|番地|番|号/g, '').toLowerCase();
}

/**
 * 書類の法人番号（13 桁）または会社法人等番号（12 桁）が、登録済みの法人番号と合うか。
 * 法人番号は「チェック用の 1 桁 + 会社法人等番号 12 桁」なので、12 桁のときは末尾 12 桁で比べる。
 * 比べられないときは null。
 */
export function corporateNumberMatches(
  registered: string | null | undefined,
  fromDoc: string | null | undefined,
): boolean | null {
  const reg = normalizeCorporateNumber(registered);
  const digits = (fromDoc ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');
  if (!reg || (digits.length !== 12 && digits.length !== 13)) return null;
  return digits.length === 13 ? digits === reg : reg.slice(1) === digits;
}

/** 登録済みの会社情報と書類の内容が合っているか */
export function checkRegisteredCompany(
  docs: ExtractedDocs,
  registered: RegisteredCompany | null | undefined,
): CrossCheckResult[] {
  const results: CrossCheckResult[] = [];
  if (!registered) return results;
  const regName = normalizeForMatch(registered.company_name);
  if (regName) {
    const docNames: Array<[string, string | null | undefined]> = [
      ['履歴事項全部証明書', docs.certificateOfHistory?.company_name],
      ['納税証明書', docs.taxCert1?.taxpayer_name],
      ['決算書', docs.financialStatements?.company_name],
    ];
    for (const [label, name] of docNames) {
      const n = normalizeForMatch(name);
      if (!n || n === regName) continue;
      results.push({
        level: 'error',
        field: 'registered.company_name',
        message: `${label}の会社名（${name}）が、登録されている会社名（${registered.company_name}）と一致しません。`,
      });
    }
  }
  const corpOk = corporateNumberMatches(registered.corporate_number, docs.certificateOfHistory?.company_number);
  if (corpOk === false) {
    results.push({
      level: 'error',
      field: 'registered.corporate_number',
      message: `履歴事項全部証明書の会社法人等番号（${docs.certificateOfHistory?.company_number}）が、登録されている法人番号（${registered.corporate_number}）と一致しません。`,
    });
  }
  return results;
}

export function crossCheckCorporation(docs: ExtractedDocs, rules: DocRules = DEFAULT_DOC_RULES): CrossCheckResult[] {
  const results: CrossCheckResult[] = [];

  // 1. 会社名一致チェック
  const names = [
    docs.certificateOfHistory?.company_name,
    docs.taxCert1?.taxpayer_name,
    docs.financialStatements?.company_name,
  ].filter(Boolean);
  if (names.length >= 2) {
    const normalized = new Set(names.map((n) => normalizeCompanyName(n!)));
    if (normalized.size > 1) {
      results.push({
        level: 'warning',
        field: 'company_name',
        message: `書類間で会社名の表記が異なります（${Array.from(new Set(names)).join(' / ')}）。ご確認ください。`,
      });
    }
  }

  // 2. 履歴事項 発行日が期限内（既定 90 日）
  const maxCertDays = rules.certificate_of_history.params.max_age_days ?? 90;
  if (docs.certificateOfHistory?.issued_date) {
    const days = daysSince(docs.certificateOfHistory.issued_date);
    if (!isNaN(days) && days > maxCertDays) {
      results.push({
        level: 'error',
        field: 'certificate_of_history.issued_date',
        message: `履歴事項全部証明書の発行から${days}日経過しています。発行から${maxCertDays}日以内のものを再取得してください。`,
      });
    } else if (!isNaN(days) && days > maxCertDays - 15) {
      results.push({
        level: 'warning',
        field: 'certificate_of_history.issued_date',
        message: `履歴事項全部証明書の発行から${days}日経過しています。まもなく期限（${maxCertDays}日）です。`,
      });
    }
  }

  // 3. 納税証明書の種類（既定は その3）。税目は その1・その2 を求めるときだけ確認する
  const requiredTaxType = rules.tax_cert_1.params.certificate_type ?? 'その3';
  if (docs.taxCert1) {
    if (docs.taxCert1.certificate_type && docs.taxCert1.certificate_type !== requiredTaxType) {
      results.push({
        level: 'error',
        field: 'tax_cert_1.certificate_type',
        message: `納税証明書が「${requiredTaxType}」ではありません（${docs.taxCert1.certificate_type}）。${requiredTaxType}を再取得してください。`,
      });
    }
    if (
      (requiredTaxType === 'その1' || requiredTaxType === 'その2') &&
      docs.taxCert1.tax_category &&
      docs.taxCert1.tax_category !== '法人税'
    ) {
      results.push({
        level: 'error',
        field: 'tax_cert_1.tax_category',
        message: `納税証明書の税目が法人税ではありません（${docs.taxCert1.tax_category}）。法人税の納税証明書が必要です。消費税等は認められません。`,
      });
    }
  }

  // 4. 代表者名の一致
  const reps = [
    docs.certificateOfHistory?.representative_name,
    docs.taxCert1?.representative,
  ].filter(Boolean);
  if (reps.length >= 2) {
    const normalized = new Set(reps.map((n) => normalizeName(n!)));
    if (normalized.size > 1) {
      results.push({
        level: 'warning',
        field: 'representative_name',
        message: '代表者名の表記が書類間で異なります。ご確認ください。',
      });
    }
  }

  // 5. 決算書：PL・販管費・BS がそろっているか、直近1期分か
  //    アップロード直後の判定と同じロジックを使い、結果が食い違わないようにする
  if (docs.financialStatements) {
    for (const r of validateFinancialStatements(docs.financialStatements, rules.financial_statements.params)) {
      results.push({ ...r, field: `financial_statements.${r.field}` });
    }
  }

  return results;
}

export function crossCheckSoleProprietor(docs: ExtractedDocs, rules: DocRules = DEFAULT_DOC_RULES): CrossCheckResult[] {
  const maxResidentDays = rules.id_document.params.max_age_days ?? 90;
  const results: CrossCheckResult[] = [];

  // 1. 氏名一致
  const names = [
    docs.idDocument?.full_name,
    docs.taxReturn?.filer_name,
  ].filter(Boolean);
  if (names.length >= 2) {
    const normalized = new Set(names.map((n) => normalizeName(n!)));
    if (normalized.size > 1) {
      results.push({
        level: 'warning',
        field: 'applicant_name',
        message: `申請者名が書類間で異なります（${Array.from(new Set(names)).join(' / ')}）。`,
      });
    }
  }

  // 2. 住所一致
  const addresses = [
    docs.idDocument?.address,
    docs.taxReturn?.filer_address,
  ].filter(Boolean);
  if (addresses.length >= 2) {
    const normalized = new Set(addresses.map((a) => normalizeAddress(a!)));
    if (normalized.size > 1) {
      results.push({
        level: 'warning',
        field: 'address',
        message: '住所の表記が書類間で異なります。ご確認ください。',
      });
    }
  }

  // 3. 本人確認書類の期限
  if (docs.idDocument) {
    if (docs.idDocument.doc_type === 'drivers_license') {
      if (!docs.idDocument.has_front || !docs.idDocument.has_back) {
        results.push({
          level: 'error',
          field: 'id_document',
          message: '運転免許証は表面・裏面の両方が必要です。不足している面をアップロードしてください。',
        });
      }
      if (docs.idDocument.expiration_date) {
        const exp = new Date(docs.idDocument.expiration_date);
        if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
          results.push({
            level: 'error',
            field: 'id_document.expiration_date',
            message: '運転免許証の有効期限が切れています。',
          });
        }
      }
    }
    if (docs.idDocument.doc_type === 'resident_record' && docs.idDocument.issued_date) {
      const days = daysSince(docs.idDocument.issued_date);
      if (!isNaN(days) && days > maxResidentDays) {
        results.push({
          level: 'error',
          field: 'id_document.issued_date',
          message: `住民票の発行から${days}日経過しています。発行から${maxResidentDays}日以内のものを再取得してください。`,
        });
      }
    }
  }

  // 4. 確定申告書の提出証跡
  if (docs.taxReturn) {
    const hasETax = !!docs.taxReturn.e_tax_timestamp;
    const hasStamp = docs.taxReturn.office_stamp_detected === true;
    const hasReceipt = !!docs.eTaxReceipt?.receipt_datetime;
    if (!hasETax && !hasStamp && !hasReceipt) {
      results.push({
        level: 'error',
        field: 'tax_return',
        message: '確定申告書に受付印も電子申告情報もありません。電子申告受信通知を追加アップロードしてください。',
      });
    }
  }

  // 5. 青色申告チェック（白色の収支内訳書は不可）
  if (docs.blueForm && docs.blueForm.filing_type === 'white') {
    results.push({
      level: 'error',
      field: 'blue_form',
      message: '白色申告（収支内訳書）として検出されました。青色申告決算書をアップロードしてください。',
    });
  }

  return results;
}

type UploadedDocument = {
  doc_type: DocType;
  file_name: string;
  validation_errors?: unknown;
};

/** 写真の四隅チェックで引っかかった書類を、ファイルごとに送信ブロック対象として挙げる */
export function photoCornerIssues(documents: UploadedDocument[]): CrossCheckResult[] {
  const results: CrossCheckResult[] = [];
  for (const d of documents) {
    const errors = Array.isArray(d.validation_errors)
      ? (d.validation_errors as CrossCheckResult[])
      : [];
    for (const e of errors) {
      if (e.field !== PHOTO_CORNERS_FIELD) continue;
      results.push({
        level: e.level,
        field: `${d.doc_type}.${PHOTO_CORNERS_FIELD}`,
        message: `${DOC_TYPE_LABELS[d.doc_type]}「${d.file_name}」: ${e.message}`,
      });
    }
  }
  return results;
}

export function runCrossCheck(
  applicantType: 'corporation' | 'sole_proprietor',
  docs: ExtractedDocs,
  documents: UploadedDocument[] = [],
  options: CrossCheckOptions = {},
): CrossCheckResult[] {
  const rules = options.rules ?? DEFAULT_DOC_RULES;
  const results =
    applicantType === 'corporation'
      ? [...crossCheckCorporation(docs, rules), ...checkRegisteredCompany(docs, options.registered)]
      : crossCheckSoleProprietor(docs, rules);
  return [...results, ...photoCornerIssues(documents)];
}
