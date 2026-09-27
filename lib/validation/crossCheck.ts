import { daysSince } from '@/lib/utils/dateCheck';
import { DOC_TYPE_LABELS } from '@/lib/claude/docTypes';
import {
  validateFinancialStatements,
  type FinancialStatementsData,
} from '@/lib/claude/extractors/financialStatements';
import type { DocType } from '@/lib/supabase/types';

/** 写真の四隅チェック結果を validation_errors に格納するときの field 名 */
export const PHOTO_CORNERS_FIELD = 'photo_corners';

export type CrossCheckResult = {
  level: 'error' | 'warning' | 'info';
  field: string;
  message: string;
};

type ExtractedDocs = {
  certificateOfHistory?: {
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

export function crossCheckCorporation(docs: ExtractedDocs): CrossCheckResult[] {
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

  // 2. 履歴事項 発行日が90日以内
  if (docs.certificateOfHistory?.issued_date) {
    const days = daysSince(docs.certificateOfHistory.issued_date);
    if (!isNaN(days) && days > 90) {
      results.push({
        level: 'error',
        field: 'certificate_of_history.issued_date',
        message: `履歴事項全部証明書の発行から${days}日経過しています。3ヶ月以内のものを再取得してください。`,
      });
    } else if (!isNaN(days) && days > 75) {
      results.push({
        level: 'warning',
        field: 'certificate_of_history.issued_date',
        message: `履歴事項全部証明書の発行から${days}日経過しています。まもなく期限（90日）です。`,
      });
    }
  }

  // 3. 納税証明書その1 の税目チェック
  if (docs.taxCert1) {
    if (docs.taxCert1.certificate_type && docs.taxCert1.certificate_type !== 'その1') {
      results.push({
        level: 'error',
        field: 'tax_cert_1.certificate_type',
        message: `納税証明書が「その1」ではありません（${docs.taxCert1.certificate_type}）。その1を再取得してください。`,
      });
    }
    if (docs.taxCert1.tax_category && docs.taxCert1.tax_category !== '法人税') {
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
    for (const r of validateFinancialStatements(docs.financialStatements)) {
      results.push({ ...r, field: `financial_statements.${r.field}` });
    }
  }

  return results;
}

export function crossCheckSoleProprietor(docs: ExtractedDocs): CrossCheckResult[] {
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
      if (!isNaN(days) && days > 90) {
        results.push({
          level: 'error',
          field: 'id_document.issued_date',
          message: `住民票の発行から${days}日経過しています。3ヶ月以内のものを再取得してください。`,
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
): CrossCheckResult[] {
  const results =
    applicantType === 'corporation'
      ? crossCheckCorporation(docs)
      : crossCheckSoleProprietor(docs);
  return [...results, ...photoCornerIssues(documents)];
}
