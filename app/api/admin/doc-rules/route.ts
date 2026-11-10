import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ALL_DOC_TYPES } from '@/lib/docRules/defaults';
import { auditLog } from '@/lib/utils/logger';

// 書類の判定設定の保存（1 書類ずつ）
const schema = z.object({
  doc_type: z.enum(ALL_DOC_TYPES as [string, ...string[]]),
  label: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  required_corporation: z.boolean(),
  required_sole_proprietor: z.boolean(),
  accept: z.enum(['image_pdf', 'image', 'pdf']),
  params: z.object({
    max_age_days: z.number().int().min(1).max(3650).optional(),
    certificate_type: z.enum(['その1', 'その2', 'その3', 'その4']).optional(),
    required_sections: z.array(z.enum(['PL', 'SGA', 'BS', 'CF'])).optional(),
    max_period_age_days: z.number().int().min(30).max(3650).optional(),
  }),
});

export async function PUT(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('doc_type_settings')
    .upsert({ ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'doc_type' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auditLog({ actorType: 'admin', action: 'doc_rules.updated', metadata: parsed.data });
  return NextResponse.json({ ok: true });
}
