/** 会社名・氏名の表記ゆれを吸収して比較用の文字列にする（client / server 共用） */
export function normalizeName(v: string | null | undefined): string {
  if (!v) return '';
  return v
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .replace(/株式会社|有限会社|合同会社|一般社団法人|一般財団法人|医療法人|\(株\)|\(有\)|（株）|（有）/g, '')
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
