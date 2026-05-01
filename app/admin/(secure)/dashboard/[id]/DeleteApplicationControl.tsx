'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2 } from 'lucide-react';

export function DeleteApplicationControl({
  applicationId,
  applicantLabel,
}: {
  applicationId: string;
  applicantLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '削除に失敗しました');
      }
      router.push('/admin/dashboard');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        className="w-full text-accent border-accent/40 hover:bg-accent/10 hover:text-accent"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-4 h-4 mr-1" />
        この申請を削除
      </Button>
    );
  }

  const canDelete = confirmText.trim() === '削除';

  return (
    <div className="space-y-2 p-3 rounded border border-accent/40 bg-accent/5">
      <div className="text-sm font-semibold text-accent">本当に削除しますか？</div>
      <div className="text-xs text-charcoal">
        「{applicantLabel}」の申請データ・提出書類・OCR結果がすべて完全に削除されます。元に戻すことはできません。
      </div>
      <div className="text-xs text-mute">
        確認のため、下のボックスに「<span className="font-semibold">削除</span>」と入力してください。
      </div>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="削除"
        className="w-full text-sm border border-rule rounded px-2 py-1.5"
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirmText('');
            setError(null);
          }}
          disabled={loading}
        >
          キャンセル
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || loading}>
          {loading ? '削除中…' : '完全に削除'}
        </Button>
      </div>
    </div>
  );
}
