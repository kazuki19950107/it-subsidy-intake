import { NewUrlForm } from './NewUrlForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NewApplicationPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">申請URL の発行</h1>
        <p className="text-sm text-mute mt-1">
          LINE で申請者に送るための専用URLを発行します。発行したURLは30日間有効です。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>新規発行</CardTitle>
          <CardDescription>管理メモは任意です（案件識別のため）</CardDescription>
        </CardHeader>
        <CardContent>
          <NewUrlForm />
        </CardContent>
      </Card>
    </div>
  );
}
