// 同意書の文面（2026-11 にいただいたひな形「同意書 株式会社〇〇.docx」をもとにしたもの）。差し込む項目は {{変数名}} で書く。
// 文面を変えたら TEMPLATE_VERSION も上げること（締結済みの同意書には作成時の本文がそのまま残る）。

export const TEMPLATE_VERSION = 'consent-2026-11-12';
export const CONTRACT_TITLE = '同意書';

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
  /** 宛名（案件のベンダーの正式な会社名。無ければ自社名） */
  addressee: string;
  /** 作成日（令和） */
  issued_on_wareki: string;
  /** 申請する年（西暦） */
  fiscal_year: string;
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
  addressee: '宛名',
  issued_on_wareki: '作成日（令和）',
  fiscal_year: '申請する年',
};

/** 段落は空行で区切る。{{...}} は差し込み */
export const CONTRACT_TEMPLATE = `{{issued_on_wareki}}

{{addressee}}　御中

私は{{fiscal_year}}年のIT導入補助金の申請に関して、以下の内容を確認した上で申請する事に同意いたします。

記

・過去にIT導入補助金を利用して類似のソフトウェアを導入していないこと。

・ITツールの納品後はキャンセル及び返金は行わないこと。

・導入するITツールを2年以内に解約した場合、補助金全額返金になる可能性があること。

・導入したITツールを利用していなかった場合、補助金全額返金になる可能性があること。

・導入するITツールは実質無料などではないこと。

・補助金を利用して、お金の返金や割引、商品券などによる還元は一切行わないこと。

・IT導入補助金の申請には申請者自身で、申請マイページの開設や申請マイページから申込入力を行うこと。

・補助金交付後から2年以内に会社の倒産、事業廃止、代表者変更などがあった場合は補助金全額返金になる可能性があること。

以上

住　所　{{address}}
名　称　{{company_name}}
代表者　{{representative_name}}`;

/** 同意書の見た目をひな形に合わせる（日付は右・「記」は中央・「以上」は右） */
export function alignConsentHtml(html: string): string {
  return html
    .replace(/^<p>/, '<p style="text-align:right">')
    .replace('<p>記</p>', '<p style="text-align:center">記</p>')
    .replace('<p>以上</p>', '<p style="text-align:right">以上</p>');
}

/** 令和の日付（例: 令和8年5月11日）。日本時間で数える */
export function warekiDate(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600_000);
  const y = j.getUTCFullYear() - 2018;
  return `令和${y}年${j.getUTCMonth() + 1}月${j.getUTCDate()}日`;
}

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
