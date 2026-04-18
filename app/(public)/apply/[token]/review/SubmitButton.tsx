'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Send, AlertCircle } from 'lucide-react';

export function SubmitButton({
  applicationId,
  token,
  disabled,
  blockers = [],
}: {
  applicationId: string;
  token: string;
  disabled: boolean;
  blockers?: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!confirm('入力内容と書類を送信しますか？送信後は内容を変更できません。')) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '送信に失敗しました');
      }
      router.push(`/apply/${token}/complete`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {blockers.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>送信前に解消が必要な項目があります</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button size="xl" onClick={handleSubmit} disabled={disabled || submitting}>
          <Send className="w-4 h-4" />
          {submitting ? '送信中...' : disabled ? '未完了の項目があります' : 'この内容で送信する'}
        </Button>
      </div>
    </div>
  );
}
