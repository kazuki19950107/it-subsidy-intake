'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Edit2, Save, X } from 'lucide-react';

export function AdminMemoEditor({
  applicationId,
  initialMemo,
}: {
  applicationId: string;
  initialMemo: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialMemo ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_memo: value.trim() === '' ? null : value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(initialMemo ?? '');
    setEditing(false);
    setError(null);
  };

  return (
    <div className="space-y-2 p-3 rounded border border-rule bg-off-white">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-charcoal">
          管理者メモ
          <span className="ml-2 text-mute font-normal">（申請者には表示されません）</span>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="w-3 h-3" />
            編集
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="案件識別・確認用のメモを入力..."
            rows={3}
            className="text-sm"
          />
          {error && <div className="text-xs text-accent">{error}</div>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="w-3 h-3" />
              キャンセル
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-sm text-charcoal whitespace-pre-wrap min-h-[24px]">
          {initialMemo || <span className="text-mute">（未入力）</span>}
        </div>
      )}
    </div>
  );
}
