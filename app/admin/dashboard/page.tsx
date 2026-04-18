import { createServiceRoleClient } from '@/lib/supabase/server';
import { ApplicationList, type ApplicationWithProgress } from '@/components/admin/ApplicationList';
import { computeProgress } from '@/lib/utils/progress';
import type { Application, DocType } from '@/lib/supabase/types';

// 静的プリレンダーされると admin_memo 編集や新規発行が反映されないため毎回SSR。
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardRow = Application & { documents: Array<{ doc_type: DocType }> };

export default async function DashboardPage() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('applications')
    .select('*, documents(doc_type)')
    .order('updated_at', { ascending: false });

  const rows = (data ?? []) as unknown as DashboardRow[];

  const applications: ApplicationWithProgress[] = rows.map((r) => {
    const progress = computeProgress(r, r.documents ?? []);
    return { ...r, _progress: progress.percent, _step: progress.currentStep };
  });

  const counts = {
    total: applications.length,
    draft: applications.filter((a) => a.status === 'draft').length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    completed: applications.filter((a) => a.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">申請一覧</h1>
        <p className="text-sm text-mute">受付状況を管理します</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="合計" value={counts.total} />
        <StatCard label="入力中" value={counts.draft} />
        <StatCard label="送信済" value={counts.submitted} color="text-teal" />
        <StatCard label="完了" value={counts.completed} color="text-ok" />
      </div>

      <div className="bg-white rounded-md border border-rule">
        <ApplicationList applications={applications} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-md border border-rule p-4">
      <div className="text-xs text-mute">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}
