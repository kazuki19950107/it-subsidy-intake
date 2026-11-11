'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, FileText, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InvoiceDialog } from '@/components/admin/InvoiceDialog';
import { calcInvoiceAmounts, yen } from '@/lib/billing/invoice';
import type { VendorDocsSummary } from '@/lib/vendorDocs/service';

const STATUS: Record<string, { label: string; variant: 'muted' | 'secondary' | 'success' | 'destructive' }> = {
  sent: { label: '未確認', variant: 'muted' },
  viewed: { label: '確認済み・未署名', variant: 'secondary' },
  signed: { label: '締結済み', variant: 'success' },
};

function jst(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';
}

/** 採択後に、ベンダーからお客様へ出す請求書と契約書（発行元はベンダー） */
export function VendorDocsPanel({
  applicationId,
  summary,
  client,
  contractUrl,
}: {
  applicationId: string;
  summary: VendorDocsSummary;
  client: { company_name: string | null; address: string | null };
  contractUrl: string | null;
}) {
  const router = useRouter();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { vendor, items, invoice, contract } = summary;
  const amounts = calcInvoiceAmounts(
    items.map((i) => i.amount),
    'exclusive',
    0.1,
  );

  const makeContract = async () => {
    if (contract && contract.status !== 'signed' && !confirm('契約書を作り直します。送ったURLは使えなくなります。よろしいですか？')) return;
    if (contract?.status === 'signed' && !confirm('締結済みの契約書があります。新しい契約書を別に作りますか？（締結済みのものは残ります）')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/vendor-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>ベンダーからお客様への書類（採択後）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!vendor ? (
          <div className="text-mute">案件にベンダーが設定されていません。上の「案件の情報」でベンダーを選んでください。</div>
        ) : (
          <>
            <div className="text-xs text-mute">
              発行元: <span className="text-ink font-semibold">{vendor.name}</span>
              {vendor.missing.length > 0 && (
                <span className="text-accent">
                  {' '}
                  ・まだ入っていない項目: {vendor.missing.join('・')}（
                  <Link href={`/admin/vendors?docs=${vendor.id}`} className="underline">
                    ベンダーの「請求書・契約書の設定」
                  </Link>
                  ）
                </span>
              )}
            </div>

            {/* ポータルの IT ツール */}
            <div>
              <div className="text-xs font-semibold text-mute mb-1">ポータルの申請内容（ITツール・税抜）</div>
              {items.length === 0 ? (
                <div className="text-xs text-mute">
                  ポータルの申請内容がまだ読めていません。「ポータル連携」で交付申請番号を紐付けると、次の同期で読み取ります（請求書は品目を手で入れても作れます）。
                </div>
              ) : (
                <table className="w-full text-sm tabular-nums">
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.label} className="border-b border-rule/50">
                        <td className="py-1 pr-2">{i.label}</td>
                        <td className="py-1 text-right whitespace-nowrap">{yen(i.amount)}</td>
                      </tr>
                    ))}
                    <tr className="text-xs text-mute">
                      <td className="py-1 pr-2 text-right">税抜 {yen(amounts.subtotal)}・消費税 {yen(amounts.tax)}</td>
                      <td className="py-1 text-right font-semibold text-ink whitespace-nowrap">税込 {yen(amounts.total)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {summary.detailFetchedAt && <div className="text-[11px] text-mute mt-1">ポータルから読んだ日時: {jst(summary.detailFetchedAt)}</div>}
            </div>

            {error && <div className="text-accent">{error}</div>}

            <div className="grid gap-3 md:grid-cols-2">
              {/* 請求書 */}
              <div className="rounded-md border border-rule p-3 space-y-2">
                <div className="font-semibold text-ink">請求書</div>
                {invoice ? (
                  <a
                    href={`/api/admin/invoices/${invoice.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-teal hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    {invoice.invoice_no}（{invoice.total.toLocaleString()}円・期限 {invoice.due_on}）
                  </a>
                ) : (
                  <div className="text-xs text-mute">まだ作っていません。</div>
                )}
                <div>
                  <Button size="sm" variant={invoice ? 'outline' : 'default'} onClick={() => setInvoiceOpen(true)}>
                    {invoice ? '請求書を作り直す' : '請求書を作る'}
                  </Button>
                </div>
              </div>

              {/* 契約書 */}
              <div className="rounded-md border border-rule p-3 space-y-2">
                <div className="font-semibold text-ink flex items-center gap-2">
                  契約書（電子署名）
                  {contract && STATUS[contract.status] && <Badge variant={STATUS[contract.status].variant}>{STATUS[contract.status].label}</Badge>}
                </div>
                {contract ? (
                  <>
                    {contract.status === 'signed' ? (
                      <div className="text-xs">
                        署名: {contract.signer_name}（{jst(contract.signed_at)}）
                      </div>
                    ) : (
                      contractUrl && (
                        <div className="flex gap-2">
                          <Input readOnly value={contractUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(contractUrl);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            }}
                            aria-label="署名URLをコピー"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      )
                    )}
                    <a
                      href={`/api/admin/contracts/${contract.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {contract.status === 'signed' ? '締結済みのPDF' : '印刷用のPDF（紙で署名するとき）'}
                    </a>
                  </>
                ) : (
                  <div className="text-xs text-mute">まだ作っていません。作ると署名URLができ、お客様に送れます。</div>
                )}
                <div>
                  <Button size="sm" variant={contract ? 'outline' : 'default'} onClick={makeContract} disabled={busy}>
                    {busy ? '作成中…' : contract ? '契約書を作り直す' : '契約書を作る'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {vendor && invoiceOpen && (
          <InvoiceDialog
            endpoint={`/api/admin/applications/${applicationId}/vendor-invoice`}
            title="お客様への請求書を作る"
            issuerName={vendor.name}
            initial={{
              billTo: `${client.company_name ?? ''} 御中`,
              address: client.address,
              items: items.map((i) => ({ label: i.label, amount: i.amount })),
            }}
            replacing={invoice?.invoice_no ?? null}
            missingSettings={vendor.missing}
            settingsHref={`/admin/vendors?docs=${vendor.id}`}
            settingsLabel={`ベンダー「${vendor.name}」の「請求書・契約書の設定」`}
            amountHint="税別で入れる・消費税10%を上乗せ"
            open={invoiceOpen}
            onClose={() => setInvoiceOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
