'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAutoSave } from '@/lib/hooks/useAutoSave';

type IntakeFields = {
  recipient_label: string | null;
  subsidy_program_label: string | null;
  applicant_deadline: string | null;
  intake_message: string | null;
};

// ISO -> datetime-local の "YYYY-MM-DDTHH:mm"
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IntakeContentEditor({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: IntakeFields;
}) {
  const router = useRouter();
  const [recipientLabel, setRecipientLabel] = useState(initial.recipient_label ?? '');
  const [subsidyProgramLabel, setSubsidyProgramLabel] = useState(
    initial.subsidy_program_label ?? '',
  );
  const [deadlineLocal, setDeadlineLocal] = useState(isoToLocalInput(initial.applicant_deadline));
  const [intakeMessage, setIntakeMessage] = useState(initial.intake_message ?? '');

  const { save, status } = useAutoSave<Partial<IntakeFields>>({
    debounceMs: 600,
    onSave: async (patch) => {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
      router.refresh();
    },
  });

  const emitAll = (overrides: Partial<{
    recipient_label: string;
    subsidy_program_label: string;
    deadlineLocal: string;
    intake_message: string;
  }> = {}) => {
    const r = overrides.recipient_label ?? recipientLabel;
    const s = overrides.subsidy_program_label ?? subsidyProgramLabel;
    const dLocal = overrides.deadlineLocal ?? deadlineLocal;
    const m = overrides.intake_message ?? intakeMessage;
    save({
      recipient_label: r.trim() === '' ? null : r,
      subsidy_program_label: s.trim() === '' ? null : s,
      applicant_deadline: dLocal === '' ? null : new Date(dLocal).toISOString(),
      intake_message: m.trim() === '' ? null : m,
    });
  };

  return (
    <div className="space-y-3 p-4 rounded border border-rule bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-charcoal">
          申請者画面に表示する内容
        </div>
        <div className="text-xs text-mute">
          {status === 'saving' && '保存中...'}
          {status === 'saved' && '✓ 保存済み'}
          {status === 'error' && <span className="text-accent">保存失敗</span>}
        </div>
      </div>
      <p className="text-xs text-mute">
        申請者がURLを開いた時の冒頭ページに表示されます。空欄なら汎用文言のみ。
      </p>

      <div className="space-y-2">
        <Label htmlFor="recipient">宛名</Label>
        <Input
          id="recipient"
          value={recipientLabel}
          onChange={(e) => {
            setRecipientLabel(e.target.value);
            emitAll({ recipient_label: e.target.value });
          }}
          placeholder="例: 田中様 / 株式会社○○ ご担当者様"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subsidy">補助金種別・公募</Label>
        <Input
          id="subsidy"
          value={subsidyProgramLabel}
          onChange={(e) => {
            setSubsidyProgramLabel(e.target.value);
            emitAll({ subsidy_program_label: e.target.value });
          }}
          placeholder="例: IT導入補助金 2026年度 通常枠 3次公募"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">提出目安日</Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={deadlineLocal}
          onChange={(e) => {
            setDeadlineLocal(e.target.value);
            emitAll({ deadlineLocal: e.target.value });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">案内メッセージ</Label>
        <Textarea
          id="message"
          value={intakeMessage}
          onChange={(e) => {
            setIntakeMessage(e.target.value);
            emitAll({ intake_message: e.target.value });
          }}
          rows={4}
          placeholder="例: ご紹介ありがとうございます。下記より書類のご提出をお願いいたします。"
        />
      </div>
    </div>
  );
}
