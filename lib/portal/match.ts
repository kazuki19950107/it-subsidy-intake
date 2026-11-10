/** 全角英数字・全角記号の一部を半角にする */
export function toHalfWidth(v: string): string {
  return v
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[×✕✖]/g, '×')
    .replace(/　/g, ' ');
}

/**
 * 会社名・氏名の表記ゆれを吸収して比較用の文字列にする（client / server 共用）
 * - 全角英数は半角に、空白は除去、法人格（株式会社など）は除去、末尾の「様」「御中」は除去
 */
export function normalizeName(v: string | null | undefined): string {
  if (!v) return '';
  return toHalfWidth(v)
    .replace(/[\s]+/g, '')
    .replace(/(様|御中|さま)+$/g, '')
    .replace(/株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|医療法人|\(株\)|\(有\)|（株）|（有）|㈱|㈲/g, '')
    .replace(/[・･.,、。‐‑–—ー－-]/g, '')
    .toLowerCase();
}

/** 片方がもう片方を含めば候補とみなす（3 文字以上のときだけ） */
export function namesLikelyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (x.length < 3 || y.length < 3) return false;
  return x.includes(y) || y.includes(x);
}

/** 法人番号を 13 桁の数字にそろえる。13 桁でなければ null */
export function normalizeCorporateNumber(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = toHalfWidth(v).replace(/[^0-9]/g, '');
  return digits.length === 13 ? digits : null;
}
