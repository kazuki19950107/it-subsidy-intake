'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check } from 'lucide-react';

export function NewUrlForm() {
  const [memo, setMemo] = useState('');
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
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memo || null }),
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
              案件識別・確認用のメモです。申請者には表示されません。後から編集も可能です。
            </p>
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
          <Button variant="outline" onClick={() => setResult(null)} className="w-full">
            続けて別のURLを発行する
          </Button>
        </div>
      )}
    </div>
  );
}
