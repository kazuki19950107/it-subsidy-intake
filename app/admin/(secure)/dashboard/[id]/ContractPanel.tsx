'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ContractSummary = {
  id: string;
  status: 'sent' | 'viewed' | 'signed' | 'void';
  url: string;
  signer_name: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signed_pdf_sha256: string | null;
  viewed_at: string | null;
  created_at: string;
} | null;

const STATUS: Record<string, { label: string; variant: 'muted' | 'secondary' | 'success' | 'destructive' }> = {
  sent: { label: '未確認', variant: 'muted' },
  viewed: { label: '確認済み・未署名', variant: 'secondary' },
  signed: { label: '締結済み', variant: 'success' },
  void: { label: '無効', variant: 'destructive' },
};

function jst(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';
}

export function ContractPanel({ applicationId, contract }: { applicationId: string; contract: ContractSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const regenerate = async () => {
    if (contract && !confirm('今の案件情報で同意書を作り直します。送付済みのURLは使えなくなります。よろしいですか？')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/contract`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '作成に失敗しました');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>同意書（電子契約）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error && <div className="text-accent">{error}</div>}
        {!contract ? (
          <div className="space-y-2">
            <div className="text-mute">まだ作成されていません。会社情報を入れてから作成してください。</div>
            <Button size="sm" onClick={regenerate} disabled={busy}>
              {busy ? '作成中...' : '同意書を作成する'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS[contract.status].variant}>{STATUS[contract.status].label}</Badge>
              <span className="text-xs text-mute">作成 {jst(contract.created_at)}</span>
            </div>
            {contract.status !== 'signed' && (
              <div className="flex gap-2">
                <Input readOnly value={contract.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(contract.url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            )}
            {contract.status === 'signed' && (
              <div className="space-y-1 text-xs">
                <div>署名者: {contract.signer_name}</div>
                <div>署名日時: {jst(contract.signed_at)}</div>
                <div>IPアドレス: {contract.signer_ip ?? '-'}</div>
                <div className="break-all">PDFのSHA-256: <span className="font-mono">{contract.signed_pdf_sha256}</span></div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <a href={`/api/admin/contracts/${contract.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileDown className="w-4 h-4" />
                  {contract.status === 'signed' ? '締結済みPDF' : 'PDFを確認'}
                </a>
              </Button>
              {contract.status !== 'signed' && (
                <Button size="sm" variant="outline" onClick={regenerate} disabled={busy}>
                  {busy ? '作成中...' : '今の情報で作り直す'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
