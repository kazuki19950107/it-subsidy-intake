/** 全角英数・ハイフン・空白を正規化して交付申請番号を比較可能にする（client / server 共用） */
export function normalizeApplicationNo(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－‐‑–—ー]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
  return s === '' ? null : s;
}
