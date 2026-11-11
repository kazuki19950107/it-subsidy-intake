// LINE のメッセージを一覧の「最後のメッセージ」や吹き出しに出す文字にする（画面とサーバーの両方で使う）

export const TYPE_LABELS: Record<string, string> = {
  image: '[画像]',
  video: '[動画]',
  audio: '[音声]',
  file: '[ファイル]',
  sticker: '[スタンプ]',
  location: '[位置情報]',
};

export type MessageLike = {
  message_type: string;
  text?: string | null;
  file_name?: string | null;
  unsent_at?: string | null;
};

/** 一覧に出す 1 行の文字 */
export function previewOf(m: MessageLike): string {
  if (m.unsent_at) return 'メッセージの送信が取り消されました';
  if (m.message_type === 'text') return (m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (m.message_type === 'file' && m.file_name) return `[ファイル] ${m.file_name}`.slice(0, 80);
  if (m.message_type === 'location' && m.text) return `[位置情報] ${m.text}`.slice(0, 80);
  return TYPE_LABELS[m.message_type] ?? `[${m.message_type}]`;
}

/** スタンプの画像（LINE の公開 CDN） */
export function stickerUrl(stickerId: string): string {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(stickerId)}/android/sticker.png`;
}

/** 日付の区切り（今日・昨日・M月D日(曜)、別の年は YYYY年 を付ける） */
export function dateLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400_000);
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const md = `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/** 一覧の時刻（今日なら HH:mm、昨日なら「昨日」、それ以外は M/D） */
export function shortTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const label = dateLabel(iso, now);
  if (label === '今日') return hhmm(iso);
  if (label === '昨日') return '昨日';
  return d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 文中の URL を見つける（リンクにするため） */
export function splitLinks(text: string): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = [];
  const re = /https?:\/\/[^\s<>"'）」]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
