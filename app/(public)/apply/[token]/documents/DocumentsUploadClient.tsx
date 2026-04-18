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
  financial_statements: '直近期の決算書（損益計算書 P/L と貸借対照表 B/S を含むもの）を1ファイルでアップロードしてください。会計事務所から渡されたPDFをそのまま投げ込めばOKです。販管費内訳は通常PL内に含まれます。',
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

  // 必須書類のうち「成功した（または進行中・解析中の）書類が1件以上ある」種別をカウント。
  // failed のみ・未アップロードは未提出扱い。
  const isSubmitted = (t: DocType) => {
    const docs = groupedByType[t] ?? [];
    return docs.some((d) => d.ocr_status !== 'failed');
  };
  const missingCount = required.filter((t) => !isSubmitted(t)).length;

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
              // この docType の書類を最新の状態で差し替える。
              // 既存書類は元の Document をベースに status/ocr_result を更新、
              // 新規アップロードは UploadedDoc から最低限の Document を生成する。
              const others = allDocs.filter((d) => d.doc_type !== docType);
              const reconstructed: Document[] = updated.map((u) => {
                const found = allDocs.find((d) => d.id === u.id);
                if (found) {
                  return {
                    ...found,
                    ocr_status: u.ocr_status,
                    ocr_result: u.ocr_result,
                    ocr_error: u.ocr_error,
                    validation_errors:
                      u.validation_errors as unknown as Document['validation_errors'],
                  };
                }
                return {
                  id: u.id,
                  application_id: applicationId,
                  doc_type: docType,
                  doc_subtype: null,
                  storage_path: '',
                  file_name: u.file_name,
                  file_mime: '',
                  file_size: 0,
                  file_hash: null,
                  ocr_status: u.ocr_status,
                  ocr_result: u.ocr_result,
                  ocr_confidence: null,
                  ocr_error: u.ocr_error,
                  validation_errors:
                    u.validation_errors as unknown as Document['validation_errors'],
                  user_corrected: null,
                  uploaded_at: new Date().toISOString(),
                  analyzed_at: null,
                } as Document;
              });
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
