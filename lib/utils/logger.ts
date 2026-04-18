import { createServiceRoleClient } from '@/lib/supabase/server';

type ActorType = 'applicant' | 'admin' | 'system';

export async function auditLog(params: {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceRoleClient();
  await supabase.from('audit_logs').insert({
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? null,
  });
}
