'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import type { Application } from '@/lib/supabase/types';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

type Props = {
  application: Application;
  crossCheck: CrossCheckResult[];
};

function buildSummary(app: Application, crossCheck: CrossCheckResult[]): string {
  const lines: string[] = [];
  lines.push(`【IT補助金 申請受付サマリー】`);
  lines.push('');
  lines.push(`区分: ${app.applicant_type === 'corporation' ? '法人' : '個人事業主'}`);
  if (app.company_name) lines.push(`会社名: ${app.company_name}`);
  lines.push(`氏名: ${app.applicant_name ?? '(未入力)'}`);
  lines.push(`電話: ${app.phone ?? '(未入力)'}`);
  lines.push(`メール: ${app.email ?? '(未入力)'}`);
  lines.push(`LINE: ${app.line_display_name ?? '(未入力)'}`);
  const gbiz = app.gbiz_id_status === 'acquired' ? '取得済み' : app.gbiz_id_status === 'applying' ? '申請中' : '未取得';
  lines.push(`GビズID: ${gbiz}`);
  if (app.requested_amount != null) {
    lines.push(`申請予定額: ${app.requested_amount.toLocaleString()}円`);
  }
  if (app.annual_revenue != null) {
    lines.push(`直近年商: ${app.annual_revenue.toLocaleString()}円`);
  }
  if (app.notes) {
    lines.push('');
    lines.push(`【備考】`);
    lines.push(app.notes);
  }
  if (crossCheck.length > 0) {
    lines.push('');
    lines.push(`【確認事項】`);
    for (const c of crossCheck) {
      const mark = c.level === 'error' ? '【要修正】' : c.level === 'warning' ? '【要確認】' : '【参考】';
      lines.push(`${mark} ${c.message}`);
    }
  }
  return lines.join('\n');
}

export function LineSummaryBlock({ application, crossCheck }: Props) {
  const [copied, setCopied] = useState(false);
  const [showing, setShowing] = useState(false);
  const summary = buildSummary(application, crossCheck);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" onClick={() => setShowing(!showing)}>
        {showing ? 'サマリーを隠す' : 'LINE送信用サマリーを表示'}
      </Button>
      {showing && (
        <div className="space-y-2">
          <pre className="text-xs bg-off-white border border-rule rounded p-3 whitespace-pre-wrap font-sans">
            {summary}
          </pre>
          <Button variant="default" size="sm" onClick={handleCopy} className="w-full">
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                コピーしました
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                クリップボードにコピー
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
