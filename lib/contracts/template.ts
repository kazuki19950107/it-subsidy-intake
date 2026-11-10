// 同意書の文面（仮）。後から差し替える前提で、差し込む項目は {{変数名}} で書く。
// 文面を変えたら TEMPLATE_VERSION も上げること（締結済みの契約には作成時の本文がそのまま残る）。

export const TEMPLATE_VERSION = 'draft-2026-11-11';
export const CONTRACT_TITLE = '補助金申請代行に関する同意書';

export type ContractVars = {
  company_name: string;
  representative_name: string;
  address: string;
  corporate_number: string;
  tool_name: string;
  round: string;
  fee_description: string;
  issued_on: string;
  agent_name: string;
};

export const CONTRACT_VAR_LABELS: Record<keyof ContractVars, string> = {
  company_name: '申請企業名',
  representative_name: '代表者',
  address: '所在地',
  corporate_number: '法人番号',
  tool_name: 'ツール',
  round: '申請回次',
  fee_description: 'フィー',
  issued_on: '作成日',
  agent_name: '申請代行会社',
};

/** 仮の文面。段落は空行で区切る。{{...}} は差し込み */
export const CONTRACT_TEMPLATE = `{{company_name}}（以下「甲」という）と{{agent_name}}（以下「乙」という）は、甲が申請するAI導入補助金（以下「本補助金」という）の申請手続きについて、次のとおり同意する。

第1条（目的）
甲は、乙に対し、本補助金（{{round}}・{{tool_name}}）の申請に必要な手続きの支援および代行を依頼し、乙はこれを受託する。

第2条（甲の情報）
所在地: {{address}}
代表者: {{representative_name}}
法人番号: {{corporate_number}}

第3条（甲の協力）
甲は、申請に必要な書類および情報を、乙の求めに応じて速やかに、かつ正確に提供する。

第4条（報酬）
甲は、乙に対し、{{fee_description}}支払う。

第5条（秘密保持）
乙は、本同意書に基づき知り得た甲の情報を、本補助金の申請以外の目的に使用せず、第三者に開示しない。

第6条（その他）
本同意書に定めのない事項は、甲乙協議のうえ定める。

作成日: {{issued_on}}`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** {{変数}} を差し込んだプレーンテキスト。未入力の項目は「（未入力）」 */
export function renderContractText(template: string, vars: Partial<ContractVars>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v && v.trim() !== '' ? v : '（未入力）';
  });
}

/** 差し込み済みの本文を HTML にする（段落は <p>、改行は <br>） */
export function renderContractHtml(template: string, vars: Partial<ContractVars>): string {
  const text = renderContractText(template, vars);
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** 文面に出てくる変数のうち、値が空のもの */
export function missingContractVars(template: string, vars: Partial<ContractVars>): Array<keyof ContractVars> {
  const keys = new Set<keyof ContractVars>();
  for (const m of template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    const k = m[1] as keyof ContractVars;
    const v = vars[k];
    if (!v || v.trim() === '') keys.add(k);
  }
  return Array.from(keys);
}
