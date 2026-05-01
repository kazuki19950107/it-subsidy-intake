'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, ExternalLink, Share2, RefreshCw, X } from 'lucide-react';

export function AgentShareBlock({
  applicationId,
  initialShareToken,
  initialExpiresAt,
}: {
  applicationId: string;
  initialShareToken: string | null;
  initialExpiresAt: string | null;
}) {
  const router = useRouter();
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSR と CSR で host が異なる（ポートずれ等）と hydration mismatch するため、
  // マウント後に window.location.origin を確定する。
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    setBase(window.location.origin);
  }, []);
  const url = shareToken && base ? `${base}/share/${shareToken}` : null;

  const issue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/share`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '発行に失敗しました');
      }
      const j = await res.json();
      // share_url から token 部分を取り出す
      const m = (j.share_url as string).match(/\/share\/([^/?#]+)/);
      setShareToken(m ? m[1] : null);
      setExpiresAt(j.expires_at);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    if (!confirm('共有URLを停止します。代行会社からアクセスできなくなりますが、よろしいですか？')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/share`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '停止に失敗しました');
      }
      setShareToken(null);
      setExpiresAt(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!shareToken) {
    return (
      <div className="space-y-2 p-3 rounded border border-rule bg-off-white">
        <div className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          申請代行会社用 共有URL
        </div>
        <p className="text-xs text-mute">
          申請内容と提出書類を読み取り専用で共有できるURLを発行します。代行会社にこのURLを送ると、ログイン不要で内容を確認できます。
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button variant="outline" size="sm" onClick={issue} disabled={loading} className="w-full">
          <Share2 className="w-3 h-3" />
          {loading ? '発行中…' : '共有URLを発行する'}
        </Button>
      </div>
    );
  }

  const exp = expiresAt ? new Date(expiresAt) : null;
  const daysLeft = exp
    ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-2 p-3 rounded border border-teal/30 bg-teal-light/30">
      <div className="text-xs font-semibold text-teal-dark flex items-center gap-1.5">
        <Share2 className="w-3.5 h-3.5" />
        申請代行会社用 共有URL
      </div>
      <div className="flex gap-1">
        <Input
          readOnly
          value={url ?? ''}
          className="font-mono text-xs h-9"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="default" size="sm" onClick={copy}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'コピー済' : 'コピー'}
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={url ?? '#'} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
      {exp && (
        <div className="text-xs text-mute">
          有効期限: {exp.toLocaleString('ja-JP')}（あと{daysLeft}日）
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={issue}
          disabled={loading}
          className="flex-1"
        >
          <RefreshCw className="w-3 h-3" />
          再発行
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={revoke}
          disabled={loading}
          className="flex-1 text-accent border-accent/40 hover:bg-accent/10 hover:text-accent"
        >
          <X className="w-3 h-3" />
          共有停止
        </Button>
      </div>
    </div>
  );
}
