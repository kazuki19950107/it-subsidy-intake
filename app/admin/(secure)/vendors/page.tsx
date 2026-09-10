import { listVendorsWithCounts } from '@/lib/vendors/queries';
import { VendorManager } from './VendorManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VendorsPage() {
  const vendors = await listVendorsWithCounts();
  const activeCount = vendors.filter((v) => v.active).length;
  const assignedCount = vendors.reduce((sum, v) => sum + v.application_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">ベンダー管理</h1>
        <p className="text-sm text-mute">
          案件で利用しているベンダー（IT導入支援事業者など）を登録・管理します。申請ごとの割り当ては各申請の詳細画面から行えます。
        </p>
        <p className="text-xs text-mute mt-1">
          登録 {vendors.length}件（有効 {activeCount}件）・割り当て済み申請 {assignedCount}件
        </p>
      </div>

      <VendorManager initialVendors={vendors} />
    </div>
  );
}
