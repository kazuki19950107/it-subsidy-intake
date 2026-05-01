'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { useAutoSave } from '@/lib/hooks/useAutoSave';

export function AdminMemoEditor({
  applicationId,
  initialMemo,
}: {
  applicationId: string;
  initialMemo: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialMemo ?? '');

  const { save: autoSave, status } = useAutoSave<{ admin_memo: string | null }>({
    debounceMs: 600,
    onSave: async ({ admin_memo }) => {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_memo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
      router.refresh();
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    autoSave({ admin_memo: v.trim() === '' ? null : v });
  };

  return (
    <div className="space-y-2 p-3 rounded border border-rule bg-off-white">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-charcoal">
          管理者メモ
          <span className="ml-2 text-mute font-normal">（申請者には表示されません）</span>
        </div>
        <div className="text-xs text-mute">
          {status === 'saving' && '保存中...'}
          {status === 'saved' && '✓ 保存済み'}
          {status === 'error' && <span className="text-accent">保存失敗</span>}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder="案件識別・確認用のメモを入力..."
        rows={3}
        className="text-sm"
      />
    </div>
  );
}
