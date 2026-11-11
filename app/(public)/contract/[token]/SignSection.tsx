'use client';

import { useState } from 'react';
import { fillConsentParty, setConsentDate, warekiDate, type ConsentParty } from '@/lib/contracts/template';
import { SignForm } from './SignForm';

/** 未署名の書類: 本文と署名欄。同意書の「住所・名称・代表者」は入力した値をその場で本文に入れて見せる */
export function SignSection({
  token,
  label,
  title,
  bodyHtml,
  initialParty,
}: {
  token: string;
  label: string;
  title: string;
  bodyHtml: string;
  initialParty: ConsentParty | null;
}) {
  const [party, setParty] = useState<ConsentParty | null>(initialParty);
  // 日付は署名する日（今日）で見せる。同意書以外は日付の行が無いので変わらない
  const dated = setConsentDate(bodyHtml, warekiDate(new Date()));
  const html = party ? fillConsentParty(dated, party) : dated;
  return (
    <>
      <article className="bg-white rounded-md border border-rule p-6 leading-relaxed text-sm text-charcoal">
        <h1 className="text-lg font-bold text-ink text-center mb-6">{title}</h1>
        <div className="space-y-3 [&_p]:whitespace-normal" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <SignForm token={token} label={label} party={party} onPartyChange={setParty} />
    </>
  );
}
