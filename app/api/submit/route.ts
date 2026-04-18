import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runCrossCheck } from '@/lib/validation/crossCheck';
import { REQUIRED_DOCS } from '@/lib/claude/extractors';
import { auditLog } from '@/lib/utils/logger';
import type { Application, Document } from '@/lib/supabase/types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { application_id } = body as { application_id: string };
  if (!application_id) {
    return NextResponse.json({ error: 'application_id が必要です' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('id', application_id)
    .maybeSingle();
  const app = data as Application | null;
  if (!app) return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 });
  if (!app.applicant_type) {
    return NextResponse.json(
      { error: '申請区分（法人／個人事業主）が未選択です' },
      { status: 400 },
    );
  }
  if (app.status === 'submitted' || app.status === 'completed') {
    return NextResponse.json(
      { error: '既に送信済みです' },
      { status: 409 },
    );
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application_id);
  const documents = (docs ?? []) as Document[];

  // 必須書類チェック
  const required = REQUIRED_DOCS[app.applicant_type];
  const uploadedTypes = new Set(documents.map((d) => d.doc_type));
  const missing = required.filter((t) => !uploadedTypes.has(t));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `未提出の必須書類があります: ${missing.join(', ')}`,
        missing,
      },
      { status: 400 },
    );
  }

  // クロスチェック用に書類データを整形
  const byType = documents.reduce<Record<string, Document>>((acc, d) => {
    acc[d.doc_type] = d;
    return acc;
  }, {});
  const pick = (d?: Document) =>
    (d?.user_corrected ?? d?.ocr_result ?? null) as Record<string, unknown> | null;

  const extracted = {
    certificateOfHistory: pick(byType.certificate_of_history),
    taxCert1: pick(byType.tax_cert_1),
    taxCert2: pick(byType.tax_cert_2),
    financialStatements: pick(byType.financial_statements),
    idDocument: pick(byType.id_document),
    taxReturn: pick(byType.tax_return),
    blueForm: pick(byType.blue_form),
    eTaxReceipt: pick(byType.e_tax_receipt),
  };

  const crossCheckResults = runCrossCheck(app.applicant_type, extracted);
  const hasBlockingErrors = crossCheckResults.some((r) => r.level === 'error');

  // 基本情報の必須項目チェック
  const basicMissing: string[] = [];
  if (!app.applicant_name) basicMissing.push('氏名');
  if (!app.applicant_kana) basicMissing.push('フリガナ');
  if (!app.phone) basicMissing.push('電話番号');
  if (!app.email) basicMissing.push('メールアドレス');
  if (!app.line_display_name) basicMissing.push('LINE表示名');
  if (app.applicant_type === 'corporation' && !app.company_name) basicMissing.push('会社名');
  if (basicMissing.length > 0) {
    return NextResponse.json(
      {
        error: `基本情報が未入力です: ${basicMissing.join('、')}`,
        basic_missing: basicMissing,
      },
      { status: 400 },
    );
  }

  // クロスチェックでエラーがある場合は送信を拒否
  if (hasBlockingErrors) {
    return NextResponse.json(
      {
        error: '書類の内容に不備があります。書類アップロード画面で修正してから再度お試しください。',
        cross_check: crossCheckResults,
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from('applications')
    .update({
      status: 'submitted',
      submitted_at: now,
    })
    .eq('id', application_id);

  await auditLog({
    actorType: 'applicant',
    action: 'application.submitted',
    targetType: 'application',
    targetId: application_id,
    metadata: {
      has_errors: hasBlockingErrors,
      cross_check_count: crossCheckResults.length,
    },
  });

  return NextResponse.json({
    ok: true,
    cross_check: crossCheckResults,
    has_blocking_errors: hasBlockingErrors,
  });
}
