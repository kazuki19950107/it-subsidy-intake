import { DOC_TYPE_LABELS } from '@/lib/claude/docTypes';
import type { DocType } from '@/lib/supabase/types';

/** ファイル名に使えない文字を除去/置換 */
function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function extOf(fileName: string): string {
  const m = fileName.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0].toLowerCase() : '';
}

/**
 * 「{会社名 or 申請者名}_{書類種別}.{拡張子}」のダウンロード用ファイル名を作る。
 * 例: "株式会社ABC_履歴事項全部証明書.pdf"
 */
export function buildDownloadName(args: {
  docType: DocType;
  fileName: string;
  companyName: string | null;
  applicantName: string | null;
}): string {
  const { docType, fileName, companyName, applicantName } = args;
  const subject = companyName?.trim() || applicantName?.trim() || '申請書類';
  const label = DOC_TYPE_LABELS[docType] ?? docType;
  const ext = extOf(fileName);
  return sanitize(`${subject}_${label}${ext}`);
}
