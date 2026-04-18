'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserSquare2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { useAutoSave } from '@/lib/hooks/useAutoSave';

type Type = 'corporation' | 'sole_proprietor';

type Props = {
  token: string;
  applicationId: string;
  initial: Type | null;
};

export function TypeSelector({ token, applicationId, initial }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Type | null>(initial);
  const [saving, setSaving] = useState(false);

  const { save: autoSave } = useAutoSave<{ applicant_type: Type }>({
    debounceMs: 0,
    onSave: async ({ applicant_type }) => {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant_type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
    },
  });

  const handleSelect = (type: Type) => {
    setSelected(type);
    autoSave({ applicant_type: type });
  };

  const handleNext = () => {
    if (!selected) return;
    setSaving(true);
    router.push(`/apply/${token}/info`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          onClick={() => handleSelect('corporation')}
          className={cn(
            'cursor-pointer p-6 transition-all hover:border-teal',
            selected === 'corporation' && 'ring-2 ring-teal bg-teal-light/30',
          )}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <Building2 className="w-12 h-12 text-teal" />
            <div>
              <h3 className="text-lg font-bold text-ink">法人</h3>
              <p className="text-sm text-mute mt-1">株式会社・合同会社など</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => handleSelect('sole_proprietor')}
          className={cn(
            'cursor-pointer p-6 transition-all hover:border-teal',
            selected === 'sole_proprietor' && 'ring-2 ring-teal bg-teal-light/30',
          )}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <UserSquare2 className="w-12 h-12 text-teal" />
            <div>
              <h3 className="text-lg font-bold text-ink">個人事業主</h3>
              <p className="text-sm text-mute mt-1">青色申告・白色申告</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleNext} disabled={!selected || saving}>
          {saving ? '保存中...' : '次へ'}
        </Button>
      </div>
    </div>
  );
}
