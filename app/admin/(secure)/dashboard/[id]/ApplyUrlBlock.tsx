'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';

export function ApplyUrlBlock({
  token,
  expiresAt,
}: {
  token: string;
  expiresAt: string;
}) {
  const [copied, setCopied] = useState(false);
  // SSR と CSR で host が異なる（ポートずれ等）と hydration mismatch するため、
  // マウント後に window.location.origin を確定する。
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    setBase(window.location.origin);
  }, []);
  const url = base ? `${base}/apply/${token}` : '';

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exp = new Date(expiresAt);
  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-2 p-3 rounded border border-teal/30 bg-teal-light/30">
      <div className="text-xs font-semibold text-teal-dark">申請者に送るURL</div>
      <div className="flex gap-1">
        <Input
          readOnly
          value={url}
          className="font-mono text-xs h-9"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="default" size="sm" onClick={copy} disabled={!url}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'コピー済' : 'コピー'}
        </Button>
        <Button type="button" variant="outline" size="sm" asChild disabled={!url}>
          <a href={url || '#'} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
      <div className="text-xs text-mute">
        有効期限: {exp.toLocaleString('ja-JP')}（あと{daysLeft}日）
      </div>
    </div>
  );
}
