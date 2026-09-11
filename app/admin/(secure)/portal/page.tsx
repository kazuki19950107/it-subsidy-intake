import { listPortalCases } from '@/lib/portal/queries';
import { latestRunsByVendor, listSyncableVendors } from '@/lib/portal/sync';
import { PortalCasesClient } from './PortalCasesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortalPage() {
  const [cases, vendors, runs] = await Promise.all([
    listPortalCases(),
    listSyncableVendors(),
    latestRunsByVendor(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">ポータル案件</h1>
        <p className="text-sm text-mute">
          IT導入支援事業者ポータルの「保存済交付申請検索」から取り込んだ案件です。毎朝6時に自動取得するほか、手動でも更新できます。
        </p>
        <p className="text-xs text-mute mt-1">
          取込済み {cases.length}件・申請と紐づき済み {cases.filter((c) => c.application).length}件
        </p>
      </div>

      <PortalCasesClient
        cases={cases}
        vendors={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          lastRun: runs[v.id]
            ? {
                status: runs[v.id].status,
                finished_at: runs[v.id].finished_at,
                started_at: runs[v.id].started_at,
                rows_count: runs[v.id].rows_count,
                error: runs[v.id].error,
              }
            : null,
        }))}
      />
    </div>
  );
}
