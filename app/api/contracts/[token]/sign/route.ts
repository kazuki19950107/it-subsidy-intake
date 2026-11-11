import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContractByToken, signContract } from '@/lib/contracts/service';
import { auditLog } from '@/lib/utils/logger';

// 顧客の署名（ログイン不要・推測できないトークンで本人の同意書だけを扱う）
export const maxDuration = 60;

const schema = z
  .object({
    signer_name: z.string().trim().min(1, '氏名を入力してください').max(100),
    signer_title: z.string().trim().max(100).optional().nullable(),
    signer_email: z.string().trim().email('メールアドレスの形式が正しくありません').max(200).optional().nullable().or(z.literal('')),
    method: z.enum(['typed', 'drawn']),
    signature_image: z.string().max(400_000).optional().nullable(),
    agreed: z.literal(true, { errorMap: () => ({ message: '内容への同意が必要です' }) }),
    party: z
      .object({
        address: z.string().trim().max(300),
        company_name: z.string().trim().max(200),
        representative_name: z.string().trim().max(100),
      })
      .optional()
      .nullable(),
  })
  .refine((v) => v.method !== 'drawn' || (v.signature_image ?? '').startsWith('data:image/png;base64,'), {
    message: '手書きの署名を書いてください',
  });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);
  if (!contract) return NextResponse.json({ error: '書類が見つかりません' }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  const b = parsed.data;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || null;
  try {
    const signed = await signContract(contract, {
      signerName: b.signer_name,
      signerTitle: b.signer_title || null,
      signerEmail: b.signer_email || null,
      method: b.method,
      signatureImage: b.method === 'drawn' ? (b.signature_image ?? null) : null,
      ip,
      userAgent: req.headers.get('user-agent'),
      party: b.party ?? null,
    });
    await auditLog({
      actorType: 'applicant',
      action: 'contract.signed',
      targetType: 'contract',
      targetId: signed.id,
      metadata: { sha256: signed.signed_pdf_sha256, ip },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
