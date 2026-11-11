import { describe, expect, it } from 'vitest';
import { dateLabel, previewOf, shortTime, splitLinks, stickerUrl } from '@/lib/line/messageText';

describe('トークの表示', () => {
  it('一覧の1行（最後のメッセージ）', () => {
    expect(previewOf({ message_type: 'text', text: 'こんにちは\n書類を送ります' })).toBe('こんにちは 書類を送ります');
    expect(previewOf({ message_type: 'image' })).toBe('[画像]');
    expect(previewOf({ message_type: 'file', file_name: '決算書.pdf' })).toBe('[ファイル] 決算書.pdf');
    expect(previewOf({ message_type: 'text', text: 'x', unsent_at: '2026-11-11T00:00:00Z' })).toBe('メッセージの送信が取り消されました');
    expect(previewOf({ message_type: 'flex' })).toBe('[flex]');
  });

  it('日付の区切り', () => {
    const now = new Date(2026, 10, 11, 15, 0);
    expect(dateLabel(new Date(2026, 10, 11, 9, 0).toISOString(), now)).toBe('今日');
    expect(dateLabel(new Date(2026, 10, 10, 23, 0).toISOString(), now)).toBe('昨日');
    expect(dateLabel(new Date(2026, 10, 2, 9, 0).toISOString(), now)).toBe('11月2日(月)');
    expect(dateLabel(new Date(2025, 0, 5, 9, 0).toISOString(), now)).toBe('2025年1月5日(日)');
  });

  it('一覧の時刻', () => {
    const now = new Date(2026, 10, 11, 15, 0);
    expect(shortTime(new Date(2026, 10, 11, 9, 5).toISOString(), now)).toBe('09:05');
    expect(shortTime(new Date(2026, 10, 10, 9, 5).toISOString(), now)).toBe('昨日');
    expect(shortTime(new Date(2026, 9, 3, 9, 5).toISOString(), now)).toBe('10/3');
  });

  it('URL をリンクにする', () => {
    expect(splitLinks('詳しくは https://example.com/a?b=1 を見てください')).toEqual([
      { text: '詳しくは ' },
      { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { text: ' を見てください' },
    ]);
    expect(splitLinks('リンクなし')).toEqual([{ text: 'リンクなし' }]);
  });

  it('スタンプの画像', () => {
    expect(stickerUrl('52002734')).toBe('https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png');
  });
});
