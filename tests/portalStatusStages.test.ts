import { describe, expect, it } from 'vitest';
import { stageForPortalStatus } from '@/lib/cases/stageRules';

// IT導入支援事業者ポータルの全ステータスが、初期設定の段階（migrations 20261110 + 20261111）で
// どの段階に進むか。設定画面で連動語を変えた場合はこの表とずれてよい（初期値の確認用）。
const STAGES = [
  { id: '申請済み', sort_order: 40, milestone: null, portal_keywords: ['申請済', '不備訂正', '審査中'] },
  { id: '採択', sort_order: 50, milestone: null, portal_keywords: ['採択'] },
  { id: '交付決定', sort_order: 60, milestone: null, portal_keywords: ['交付決定', '実績報告'] },
  { id: '補助金確定', sort_order: 65, milestone: null, portal_keywords: ['確定済', '確定内容', '審査完了'] },
  { id: '補助金入金済', sort_order: 70, milestone: null, portal_keywords: ['交付済'] },
  { id: '不採択・終了', sort_order: 80, milestone: null, portal_keywords: ['不採択', '破棄', '交付取消', '辞退', '取下'] },
];

const EXPECTED: Array<[string, string | null]> = [
  ['マイページ開設済', null],
  ['IT導入支援事業者 交付申請', null],
  ['申請者 交付申請提出待ち', null],
  ['交付申請 申請済', '申請済み'],
  ['交付申請破棄', '不採択・終了'],
  ['交付決定', '交付決定'],
  ['不採択', '不採択・終了'],
  ['申請者不備訂正中', '申請済み'],
  ['IT導入支援事業者不備訂正中', '申請済み'],
  ['不備訂正 再提出待ち', '申請済み'],
  ['不備訂正再提出済', '申請済み'],
  ['補助事業者 実績報告 入力中', '交付決定'],
  ['実績報告済', '交付決定'],
  ['IT導入支援事業者 実績報告 訂正・確認中', '交付決定'],
  ['実績報告不備訂正再提出済', '交付決定'],
  ['審査完了・口座情報確認中', '補助金確定'],
  ['補助事業者 確定内容 未承認', '補助金確定'],
  ['補助金 確定済', '補助金確定'],
  ['補助事業者 確定内容 非承認', '補助金確定'],
  ['補助金 交付済', '補助金入金済'],
  ['補助金交付済（事業継続）', '補助金入金済'],
  ['交付取消', '不採択・終了'],
  ['辞退届：IT導入支援事業者承認待ち', '不採択・終了'],
  ['辞退届承認済', '不採択・終了'],
  ['効果報告　未報告', null],
];

describe('ポータルの状態 → 段階（初期設定）', () => {
  it.each(EXPECTED)('%s → %s', (status, stage) => {
    expect(stageForPortalStatus(STAGES, status)?.id ?? null).toBe(stage);
  });
});
