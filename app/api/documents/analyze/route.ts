import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeRequestSchema } from '@/lib/validation/schemas';
import { runExtractor } from '@/lib/claude/extractors';
import { normalizeMediaType } from '@/lib/claude/client';
import { sha256 } from '@/lib/utils/hash';
import { checkMonthlyBudget, checkApplicationBudget, logApiUsage } from '@/lib/utils/costGuard';
import { auditLog } from '@/lib/utils/logger';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '解析要求が不正です' },
      { status: 400 },
    );
  }
  const { document_id } = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .maybeSingle();
  if (error || !doc) {
    return NextResponse.json({ error: '書類が見つかりません' }, { status: 404 });
  }

  // コスト上限チェック
  const [monthly, perApp] = await Promise.all([
    checkMonthlyBudget(),
    checkApplicationBudget(doc.application_id),
  ]);
  if (monthly.over) {
    return NextResponse.json(
      { error: `月間API予算（$${monthly.budget}）を超過したため、現在解析を受け付けられません。サポートにご連絡ください。` },
      { status: 429 },
    );
  }
  if (perApp.over) {
    return NextResponse.json(
      { error: `1申請あたりの解析コスト上限（$${perApp.budget}）に達しました。内容を一度ご確認ください。` },
      { status: 429 },
    );
  }

  // ステータスを analyzing に
  await supabase
    .from('documents')
    .update({ ocr_status: 'analyzing' })
    .eq('id', document_id);

  try {
    // Storage からダウンロード
    const { data: file, error: dlErr } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);
    if (dlErr || !file) {
      throw new Error(`画像の取得に失敗しました: ${dlErr?.message ?? 'unknown'}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 重複解析の回避（file_hash）
    const hash = sha256(buffer);
    if (!doc.file_hash) {
      await supabase.from('documents').update({ file_hash: hash }).eq('id', document_id);
    }
    if (doc.file_hash === hash && doc.ocr_result) {
      await supabase
        .from('documents')
        .update({ ocr_status: 'done' })
        .eq('id', document_id);
      return NextResponse.json({
        ocr_result: doc.ocr_result,
        validation_errors: doc.validation_errors ?? [],
        cached: true,
      });
    }

    // PDF は MVP では先頭ページだけ対応（クライアント側で画像化済みを推奨）
    if (doc.file_mime === 'application/pdf') {
      throw new Error(
        'PDFは自動解析に対応していません。お手数ですが画像（JPEG/PNG）でアップロードし直してください。',
      );
    }

    const base64 = buffer.toString('base64');
    const mediaType = normalizeMediaType(doc.file_mime);

    const result = await runExtractor(doc.doc_type, base64, mediaType);

    await logApiUsage({
      applicationId: doc.application_id,
      documentId: document_id,
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    });

    await supabase
      .from('documents')
      .update({
        ocr_status: 'done',
        ocr_result: result.data,
        ocr_confidence: result.confidence,
        validation_errors: result.validationErrors as unknown as Record<string, unknown>[],
        analyzed_at: new Date().toISOString(),
        file_hash: hash,
      })
      .eq('id', document_id);

    await auditLog({
      actorType: 'system',
      action: 'document.analyzed',
      targetType: 'document',
      targetId: document_id,
      metadata: {
        doc_type: doc.doc_type,
        confidence: result.confidence,
        has_errors: result.validationErrors.length > 0,
      },
    });

    return NextResponse.json({
      ocr_result: result.data,
      validation_errors: result.validationErrors,
      confidence: result.confidence,
    });
  } catch (e) {
    const errMsg = (e as Error).message || '解析に失敗しました';
    await supabase
      .from('documents')
      .update({
        ocr_status: 'failed',
        ocr_error: errMsg,
      })
      .eq('id', document_id);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
