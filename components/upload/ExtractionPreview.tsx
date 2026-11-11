'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { DocType } from '@/lib/supabase/types';
import { useAutoSave } from '@/lib/hooks/useAutoSave';
import { FIELD_LABELS } from '@/lib/documents/fieldLabels';

type Props = {
  documentId: string;
  docType: DocType;
  ocrResult: Record<string, unknown>;
  onSave: (corrected: Record<string, unknown>) => void;
};


export function ExtractionPreview({ documentId, ocrResult, onSave }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(ocrResult);

  const displayKeys = Object.keys(values).filter((k) => !k.startsWith('_'));

  const { save: autoSave, status } = useAutoSave<Record<string, unknown>>({
    debounceMs: 600,
    onSave: async (corrected) => {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_corrected: corrected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
      onSave(corrected);
    },
  });

  return (
    <div className="mt-3 p-3 bg-white rounded-md border border-rule">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-charcoal">抽出結果（編集して保存）</h4>
        <div className="text-xs text-mute">
          {status === 'saving' && '保存中...'}
          {status === 'saved' && '✓ 保存済み'}
          {status === 'error' && <span className="text-accent">保存失敗</span>}
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {displayKeys.map((key) => {
          const raw = values[key];
          const label = FIELD_LABELS[key] ?? key;
          if (typeof raw === 'boolean') {
            return (
              <div key={key} className="flex items-center justify-between border-b border-rule/50 py-1.5">
                <dt className="text-mute">{label}</dt>
                <dd className="font-medium">{raw ? 'はい' : 'いいえ'}</dd>
              </div>
            );
          }
          if (Array.isArray(raw)) {
            return (
              <div key={key} className="flex items-start justify-between border-b border-rule/50 py-1.5">
                <dt className="text-mute">{label}</dt>
                <dd className="font-medium text-right">{raw.join(', ')}</dd>
              </div>
            );
          }
          return (
            <div key={key} className="flex flex-col gap-1 border-b border-rule/50 py-1.5">
              <dt className="text-xs text-mute">{label}</dt>
              <dd>
                <Input
                  value={raw == null ? '' : String(raw)}
                  onChange={(e) => {
                    const v = e.target.value;
                    const isNum = typeof raw === 'number';
                    setValues((prev) => ({
                      ...prev,
                      [key]: v === '' ? null : isNum ? Number(v) : v,
                    }));
                  }}
                  onBlur={() => autoSave(values)}
                  className="h-8 text-sm"
                />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
