'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DocumentUploader } from '@/components/upload/DocumentUploader';
import { DOC_TYPE_LABELS, REQUIRED_DOCS } from '@/lib/claude/docTypes';
import type { Document, DocType } from '@/lib/supabase/types';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

type Props = {
  token: string;
  applicationId: string;
  applicantType: 'corporation' | 'sole_proprietor';
  documents: Document[];
};

const DESCRIPTIONS: Record<DocType, string> = {
  certificate_of_history: '法務局で取得する登記簿謄本。発行から3ヶ月以内のものを提出してください。',
  tax_cert_1: '税務署で取得する「その1（納税額・未納税額）」の法人税に関する証明書。消費税の証明書は不可です。',
  tax_cert_2: '税務署で取得する「その2（所得金額）」の所得税に関する証明書。',
  financial_statements: '直近期の損益計算書（P/L）、販売費及び一般管理費内訳、貸借対照表（B/S）を全てアップロードしてください。複数枚可。',
  id_document: '運転免許証（表裏両面）、運転経歴証明書、または住民票（3ヶ月以内）のいずれか。',
  tax_return: '直近の確定申告書 第一表。電子申告の場合は受付データを、紙提出の場合は税務署受付印のあるものを。',
  blue_form: '青色申告決算書（または収支内訳書）。',
  e_tax_receipt: '確定申告書に受付印がない場合、e-Tax の受信通知（メール詳細）もアップロードしてください。',
  gbiz_screenshot: 'GビズID のマイページ画面（取得済みの場合のみ）',
};

export function DocumentsUploadClient({ token, applicationId, applicantType, documents }: Props) {
  const [allDocs, setAllDocs] = useState(documents);

  const groupedByType = allDocs.reduce<Record<string, Document[]>>((acc, d) => {
    (acc[d.doc_type] ||= []).push(d);
    return acc;
  }, {});

  const required = REQUIRED_DOCS[applicantType];
  const allRequired: DocType[] = applicantType === 'sole_proprietor'
    ? [...required, 'e_tax_receipt']
    : required;

  const missingCount = required.filter((t) => !groupedByType[t] || groupedByType[t].length === 0)
    .length;

  return (
    <div className="space-y-6">
      {allRequired.map((docType) => {
        const existing = (groupedByType[docType] ?? []).map((d) => ({
          id: d.id,
          file_name: d.file_name,
          ocr_status: d.ocr_status as 'pending' | 'analyzing' | 'done' | 'failed',
          ocr_result: (d.user_corrected ?? d.ocr_result) as Record<string, unknown> | null,
          ocr_error: d.ocr_error,
          validation_errors: (d.validation_errors ?? []) as unknown as CrossCheckResult[],
        }));
        const isRequired = required.includes(docType);
        return (
          <DocumentUploader
            key={docType}
            applicationId={applicationId}
            docType={docType}
            label={DOC_TYPE_LABELS[docType]}
            description={DESCRIPTIONS[docType]}
            required={isRequired}
            existingDocs={existing}
            onChange={(updated) => {
              // ドキュメントリストを差し替え
              const others = allDocs.filter((d) => d.doc_type !== docType);
              const reconstructed: Document[] = updated.map((u) => {
                const found = allDocs.find((d) => d.id === u.id);
                return (found ?? ({} as Document));
              }).filter((d): d is Document => !!d.id);
              setAllDocs([...others, ...reconstructed]);
            }}
          />
        );
      })}

      <div className="flex items-center justify-between pt-4 border-t border-rule">
        <div className="text-sm text-mute">
          {missingCount > 0
            ? `必須書類が ${missingCount} 件 未提出です`
            : 'すべての必須書類がアップロードされました'}
        </div>
        <Button asChild size="lg" disabled={missingCount > 0}>
          <Link href={`/apply/${token}/review`}>最終確認へ進む</Link>
        </Button>
      </div>
    </div>
  );
}
