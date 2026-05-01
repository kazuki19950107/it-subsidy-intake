'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check } from 'lucide-react';

export function NewUrlForm() {
  const [memo, setMemo] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [subsidyProgramLabel, setSubsidyProgramLabel] = useState('');
  const [applicantDeadline, setApplicantDeadline] = useState(''); // datetime-local
  const [intakeMessage, setIntakeMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ apply_url: string; expires_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // datetime-local は "YYYY-MM-DDTHH:mm"。ISO化（ローカル時刻として解釈）。
      const deadlineIso = applicantDeadline
        ? new Date(applicantDeadline).toISOString()
        : null;

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo: memo || null,
          recipient_label: recipientLabel || null,
          subsidy_program_label: subsidyProgramLabel || null,
          applicant_deadline: deadlineIso,
          intake_message: intakeMessage || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '発行失敗');
      }
      const data = await res.json();
      setResult({ apply_url: data.apply_url, expires_at: data.expires_at });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.apply_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setResult(null);
    setMemo('');
    setRecipientLabel('');
    setSubsidyProgramLabel('');
    setApplicantDeadline('');
    setIntakeMessage('');
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="memo">管理者メモ（任意）</Label>
            <Input
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例: 田中社長ご紹介 2026-04"
            />
            <p className="text-xs text-mute">
              案件識別・確認用。<strong>申請者には表示されません</strong>。
            </p>
          </div>

          <div className="border-t border-rule pt-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-charcoal">
                申請者画面に表示する内容（任意）
              </div>
              <p className="text-xs text-mute mt-1">
                申請者がURLを開いた時の冒頭ページに、案件ごとの内容として表示されます。空欄で発行すると汎用文言のみになります。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">宛名</Label>
              <Input
                id="recipient"
                value={recipientLabel}
                onChange={(e) => setRecipientLabel(e.target.value)}
                placeholder="例: 田中様 / 株式会社○○ ご担当者様"
              />
              <p className="text-xs text-mute">入力すると「○○ 様」と冒頭に表示されます。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subsidy">補助金種別・公募</Label>
              <Input
                id="subsidy"
                value={subsidyProgramLabel}
                onChange={(e) => setSubsidyProgramLabel(e.target.value)}
                placeholder="例: IT導入補助金 2026年度 通常枠 3次公募"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">提出目安日</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={applicantDeadline}
                onChange={(e) => setApplicantDeadline(e.target.value)}
              />
              <p className="text-xs text-mute">
                申請者画面に「○月○日までにご提出ください」として表示されます。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">案内メッセージ</Label>
              <Textarea
                id="message"
                value={intakeMessage}
                onChange={(e) => setIntakeMessage(e.target.value)}
                placeholder="例: ご紹介ありがとうございます。下記より書類のご提出をお願いいたします。ご不明点は LINE までお気軽にお問い合わせください。"
                rows={4}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? '発行中...' : '申請URLを発行する'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <Alert variant="default">
            <AlertDescription>
              申請URLを発行しました。下のURLをコピーして LINE で送信してください。
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>申請URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={result.apply_url}
                className="font-mono text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'コピー済' : 'コピー'}
              </Button>
            </div>
            <p className="text-xs text-mute">
              有効期限: {new Date(result.expires_at).toLocaleString('ja-JP')}
            </p>
          </div>
          <Button variant="outline" onClick={reset} className="w-full">
            続けて別のURLを発行する
          </Button>
        </div>
      )}
    </div>
  );
}
