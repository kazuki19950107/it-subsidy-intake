'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check } from 'lucide-react';
import Link from 'next/link';
import type { Account, Tool, VendorContact } from '@/lib/supabase/types';

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-rule bg-white px-3 py-2 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal';

const CASE_FIELDS = [
  { key: 'company_name', label: '会社名', placeholder: '例: MEM株式会社' },
  { key: 'corporate_number', label: '法人番号（13桁）', placeholder: '例: 1234567890123' },
  { key: 'representative_name', label: '代表者', placeholder: '例: 山田 太郎' },
  { key: 'address', label: '所在地', placeholder: '例: 東京都千代田区…' },
  { key: 'applicant_name', label: '担当者名（先方）', placeholder: '例: 佐藤 花子' },
  { key: 'phone', label: '担当者の電話番号', placeholder: '例: 03-1234-5678' },
  { key: 'email', label: '担当者のメール', placeholder: '例: sato@example.com' },
  { key: 'referrer', label: '紹介元', placeholder: '例: ○○税理士事務所' },
] as const;
type CaseKey = (typeof CASE_FIELDS)[number]['key'];
type ApplicantChoice = '' | 'corporation' | 'sole_proprietor';

export function NewUrlForm({
  vendors,
  tools,
  accounts,
}: {
  vendors: Pick<VendorContact, 'id' | 'name'>[];
  tools: Pick<Tool, 'id' | 'code' | 'name' | 'active'>[];
  accounts: Pick<Account, 'id' | 'name' | 'active'>[];
}) {
  const [caseFields, setCaseFields] = useState<Record<CaseKey, string>>(
    Object.fromEntries(CASE_FIELDS.map((f) => [f.key, ''])) as Record<CaseKey, string>,
  );
  const [applicantType, setApplicantType] = useState<ApplicantChoice>('corporation');
  const [toolId, setToolId] = useState('');
  const [round, setRound] = useState('');
  const [staffId, setStaffId] = useState('');
  const [memo, setMemo] = useState('');
  const [vendorId, setVendorId] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ apply_url: string; contract_url: string | null; id: string } | null>(null);
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
        body: JSON.stringify({
          ...caseFields,
          applicant_type: applicantType || null,
          tool_id: toolId || null,
          round: round ? Number(round) : null,
          staff_account_id: staffId || null,
          memo: memo || null,
          vendor_contact_id: vendorId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '発行失敗');
      }
      const data = await res.json();
      setResult({ apply_url: data.apply_url, contract_url: data.contract_url ?? null, id: data.id });
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
    setCaseFields(Object.fromEntries(CASE_FIELDS.map((f) => [f.key, ''])) as Record<CaseKey, string>);
    setToolId('');
    setRound('');
    setStaffId('');
    setMemo('');
    setVendorId('');
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

          <div className="space-y-4">
            <div className="text-sm font-semibold text-charcoal">会社・案件の情報</div>
            <p className="text-xs text-mute -mt-3">
              会社名を入れると、同意書が自動で作られます（あとから詳細画面で直せます）。
            </p>
            <div className="space-y-2">
              <Label htmlFor="applicant_type">区分</Label>
              <select
                id="applicant_type"
                value={applicantType}
                onChange={(e) => setApplicantType(e.target.value as ApplicantChoice)}
                className={SELECT_CLASS}
              >
                <option value="corporation">法人</option>
                <option value="sole_proprietor">個人事業主</option>
                <option value="">申請者に選んでもらう</option>
              </select>
            </div>
            {CASE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  value={caseFields[f.key]}
                  onChange={(e) => setCaseFields((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tool">ツール</Label>
                <select id="tool" value={toolId} onChange={(e) => setToolId(e.target.value)} className={SELECT_CLASS}>
                  <option value="">未設定</option>
                  {tools
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code}（{t.name}）
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="round">申請回次</Label>
                <Input id="round" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} placeholder="例: 3" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff">社内担当</Label>
              <select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={SELECT_CLASS}>
                <option value="">未設定</option>
                {accounts
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-xs text-mute">
                  <Link href="/admin/settings" className="text-teal hover:underline">設定</Link>
                  から社内担当を登録できます。
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-rule pt-4">
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

          <div className="space-y-2">
            <Label htmlFor="vendor">利用ベンダー（任意）</Label>
            <select
              id="vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">未設定（後から設定できます）</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-mute">
              この案件で利用するベンダー。申請者には表示されません。
              {vendors.length === 0 && (
                <>
                  {' '}
                  <Link href="/admin/vendors" className="text-teal hover:underline">
                    ベンダー管理
                  </Link>
                  から登録できます。
                </>
              )}
            </p>
          </div>


          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? '登録中...' : '案件を登録して申請URLを発行する'}
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
          </div>
          {result.contract_url && (
            <div className="space-y-2">
              <Label>同意書の署名URL</Label>
              <Input
                readOnly
                value={result.contract_url}
                className="font-mono text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
          <Button asChild className="w-full">
            <Link href={`/admin/dashboard/${result.id}`}>案件の詳細を開く</Link>
          </Button>
          <Button variant="outline" onClick={reset} className="w-full">
            続けて別の案件を登録する
          </Button>
        </div>
      )}
    </div>
  );
}
