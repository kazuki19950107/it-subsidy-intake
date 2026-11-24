import { describe, expect, it } from 'vitest';
import { portalHealth } from '@/lib/portal/health';

const vendors = [
  { id: 'a', name: 'A社' },
  { id: 'b', name: 'B社' },
];
const now = new Date('2026-11-25T08:30:00Z'); // 11/25 17:30 JST

describe('portalHealth', () => {
  it('全社が 1 日以内に取れていて、まとめも送れていれば何も出さない', () => {
    const h = portalHealth({
      vendors,
      lastSuccess: { a: '2026-11-25T05:00:00Z', b: '2026-11-24T20:00:00Z' },
      lastReportAt: '2026-11-25T08:00:00Z',
      now,
    });
    expect(h.ok).toBe(true);
  });

  it('1 回だけ失敗した会社（前の日の昼は取れた）は出さない', () => {
    const h = portalHealth({
      vendors,
      lastSuccess: { a: '2026-11-25T05:00:00Z', b: '2026-11-24T07:00:00Z' }, // B は 25.5 時間前
      lastReportAt: '2026-11-25T08:00:00Z',
      now,
    });
    expect(h.ok).toBe(true);
  });

  it('26 時間より長く取れていない会社を出す', () => {
    const h = portalHealth({
      vendors,
      lastSuccess: { a: '2026-11-25T05:00:00Z', b: '2026-11-24T05:00:00Z' },
      lastReportAt: '2026-11-25T08:00:00Z',
      now,
    });
    expect(h.ok).toBe(false);
    expect(h.allStale).toBe(false);
    expect(h.staleVendors.map((v) => v.name)).toEqual(['B社']);
  });

  it('一度も取れていない会社も出す', () => {
    const h = portalHealth({ vendors, lastSuccess: { a: '2026-11-25T05:00:00Z' }, lastReportAt: null, now });
    expect(h.staleVendors).toEqual([{ name: 'B社', lastSuccess: null }]);
  });

  it('全社が止まっていれば「同期が止まっている」', () => {
    const h = portalHealth({
      vendors,
      lastSuccess: { a: '2026-11-23T05:00:00Z', b: '2026-11-23T06:00:00Z' },
      lastReportAt: '2026-11-25T08:00:00Z',
      now,
    });
    expect(h.allStale).toBe(true);
    expect(h.latestSuccess).toBe('2026-11-23T06:00:00Z');
  });

  it('まとめが 17 時間より長く送られていなければ知らせる（夜のあいだの 15 時間は正常）', () => {
    const base = { vendors, lastSuccess: { a: '2026-11-25T05:00:00Z', b: '2026-11-25T05:00:00Z' } };
    // 前の日 17:00 のまとめ → 翌 08:00 の直前（15 時間）は正常
    expect(portalHealth({ ...base, lastReportAt: '2026-11-24T08:00:00Z', now: new Date('2026-11-24T22:59:00Z') }).ok).toBe(true);
    // 17 時間を過ぎたら知らせる
    const h = portalHealth({ ...base, lastReportAt: '2026-11-24T08:00:00Z', now: new Date('2026-11-25T02:00:00Z') });
    expect(h.reportStale).toBe(true);
    expect(h.ok).toBe(false);
  });
});
