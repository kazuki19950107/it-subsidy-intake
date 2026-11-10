'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Check = {
  count: number;
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
  unknownHeaders: string[];
  preview: Array<Record<string, unknown>>;
};

/** Shift_JIS（Excel の既定）と UTF-8 のどちらでも読めるようにする */
async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('shift_jis').decode(buf);
}

export function ImportClient({ headers }: { headers: string[] }) {
  const [csv, setCsv] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [createContracts, setCreateContracts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const post = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/applications/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun, createContracts }),
      });
      const b = await res.json().catch(() => ({}));
      if (dryRun) setCheck(b as Check);
      else if (!res.ok) {
        setCheck(b as Check);
        throw new Error(b.error ?? '取り込みに失敗しました');
      } else setDone(b.created as number);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const template = () => {
    const blob = new Blob(['﻿' + headers.join(',') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '案件取り込みひな形.csv';
    a.click();
  };

  if (done != null) {
    return (
      <Alert>
        <AlertDescription>
          {done}件の案件を登録しました。{' '}
          <Link href="/admin/dashboard" className="text-teal hover:underline">
            案件一覧へ
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" variant="outline" size="sm" onClick={template}>
          ひな形をダウンロード
        </Button>
        <label className="text-sm cursor-pointer inline-flex items-center gap-2 rounded-md border border-rule bg-white px-3 py-1.5 hover:bg-teal-light">
          CSVファイルを選ぶ
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setCsv(await readCsvFile(f));
                setCheck(null);
              }
            }}
          />
        </label>
      </div>
      <textarea
        className="w-full min-h-[200px] rounded-md border border-rule bg-white p-2 font-mono text-xs"
        placeholder={`${headers.join(',')}\nMEM株式会社,1234567890123,…`}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setCheck(null);
        }}
        aria-label="CSV"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-teal w-4 h-4" checked={createContracts} onChange={(e) => setCreateContracts(e.target.checked)} />
        同意書も作る（既存案件で締結済みなら不要）
      </label>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!csv.trim() || busy} onClick={() => post(true)}>
          {busy && !check ? '確認中...' : '内容を確認'}
        </Button>
        <Button disabled={!check || check.errors.length > 0 || check.count === 0 || busy} onClick={() => post(false)}>
          {busy && check ? '登録中...' : `${check?.count ?? 0}件を登録`}
        </Button>
      </div>

      {check && (
        <div className="space-y-2 text-sm">
          <div>
            {check.count}件を読み取りました。
            {check.unknownHeaders.length > 0 && <span className="text-mute">（使わない見出し: {check.unknownHeaders.join('、')}）</span>}
          </div>
          {check.errors.length > 0 && (
            <ul className="text-accent list-disc list-inside">
              {check.errors.map((e, i) => (
                <li key={i}>
                  {e.line}行目: {e.message}
                </li>
              ))}
            </ul>
          )}
          {check.warnings.length > 0 && (
            <ul className="text-warn list-disc list-inside">
              {check.warnings.map((e, i) => (
                <li key={i}>
                  {e.line}行目: {e.message}
                </li>
              ))}
            </ul>
          )}
          {check.preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-left text-mute border-b border-rule">
                    <th className="pr-2">行</th>
                    <th className="pr-2">会社名</th>
                    <th className="pr-2">法人番号</th>
                    <th className="pr-2">ツール</th>
                    <th className="pr-2">回次</th>
                    <th className="pr-2">申請番号</th>
                    <th className="pr-2">補助金額</th>
                    <th className="pr-2">段階</th>
                  </tr>
                </thead>
                <tbody>
                  {check.preview.map((r) => (
                    <tr key={String(r.line)} className="border-b border-rule/50">
                      <td className="pr-2">{String(r.line)}</td>
                      <td className="pr-2">{String(r.company_name ?? '')}</td>
                      <td className="pr-2">{String(r.corporate_number ?? '')}</td>
                      <td className="pr-2">{String(r.tool_code ?? '')}</td>
                      <td className="pr-2">{r.round != null ? String(r.round) : ''}</td>
                      <td className="pr-2">{String(r.portal_application_no ?? '')}</td>
                      <td className="pr-2">{r.subsidy_amount != null ? Number(r.subsidy_amount).toLocaleString() : ''}</td>
                      <td className="pr-2">{String(r.stage_name ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
