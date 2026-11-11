import { listVendorsWithCounts } from '@/lib/vendors/queries';
import { VendorManager } from './VendorManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ docs?: string }> }) {
  const { docs } = await searchParams;
  const vendors = await listVendorsWithCounts();
  const activeCount = vendors.filter((v) => v.active).length;
  const assignedCount = vendors.reduce((sum, v) => sum + v.application_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">ベンダー管理</h1>
        <p className="text-sm text-mute">
          案件で利用しているベンダー（IT導入支援事業者など）を登録・管理します。申請ごとの割り当ては各申請の詳細画面から行えます。「請求書・契約書」で、採択後にベンダーからお客様へ出す請求書・契約書の会社名・住所・登録番号・振込先・契約書の文面を設定します。
        </p>
        <p className="text-xs text-mute mt-1">
          登録 {vendors.length}件（有効 {activeCount}件）・割り当て済み申請 {assignedCount}件
        </p>
      </div>

      <VendorManager initialVendors={vendors} openDocsFor={docs ?? null} />
    </div>
  );
}
