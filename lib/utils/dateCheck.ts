// 日付関連ユーティリティ
// 和暦→西暦変換、発行日の期限判定など

const WAREKI_MAP: Record<string, number> = {
  令和: 2018,
  平成: 1988,
  昭和: 1925,
  大正: 1911,
  明治: 1867,
};

/**
 * 和暦文字列を YYYY-MM-DD に変換
 * 例: "令和6年3月15日" → "2024-03-15"
 * 既に YYYY-MM-DD 形式なら素通し
 */
export function warekiToSeireki(wareki: string): string | null {
  if (!wareki) return null;
  const isoMatch = wareki.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return wareki;

  const match = wareki.match(/(令和|平成|昭和|大正|明治)\s*(\d+|元)年\s*(\d+)月\s*(\d+)日/);
  if (!match) return null;
  const [, era, yearStr, monthStr, dayStr] = match;
  const year = yearStr === '元' ? 1 : parseInt(yearStr, 10);
  const base = WAREKI_MAP[era];
  if (!base) return null;
  const y = base + year;
  const m = String(parseInt(monthStr, 10)).padStart(2, '0');
  const d = String(parseInt(dayStr, 10)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NaN;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NaN;
  const ms = d.getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const since = daysSince(dateStr);
  return !isNaN(since) && since <= days && since >= 0;
}

export function formatJpDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '未取得';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
