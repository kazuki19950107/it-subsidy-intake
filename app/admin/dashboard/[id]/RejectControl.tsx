'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RejectControl({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'submitted') {
    return null;
  }

  const handleReject = async () => {
    if (!reason.trim()) {
      setError('差戻し理由を入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('差戻しに失敗しました');
      router.refresh();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        申請を差戻す
      </Button>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded border border-rule bg-off-white">
      <Label htmlFor="reason" required>
        差戻し理由
      </Label>
      <Textarea
        id="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="例: 履歴事項全部証明書の発行が90日を超えています。再取得してください。"
        rows={3}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          キャンセル
        </Button>
        <Button variant="destructive" onClick={handleReject} disabled={loading}>
          {loading ? '送信中' : '差戻し確定'}
        </Button>
      </div>
    </div>
  );
}
