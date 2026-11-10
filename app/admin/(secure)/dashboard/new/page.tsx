import { NewUrlForm } from './NewUrlForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { listActiveVendors } from '@/lib/vendors/queries';
import { getCaseOptions } from '@/lib/cases/queries';

export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const [vendors, options] = await Promise.all([listActiveVendors(), getCaseOptions()]);
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">案件の登録</h1>
        <p className="text-sm text-mute mt-1">
          案件を登録し、申請者に送る書類提出フォームの専用URL（期限なし）と同意書を作ります。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>新規登録</CardTitle>
          <CardDescription>管理メモは任意です（案件識別のため）</CardDescription>
        </CardHeader>
        <CardContent>
          <NewUrlForm vendors={vendors} tools={options.tools} accounts={options.accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
