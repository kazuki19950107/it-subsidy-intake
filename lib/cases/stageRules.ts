import type { Milestone } from './constants';

export type StageRule = {
  id: string;
  sort_order: number;
  milestone: Milestone | null;
  portal_keywords: string[] | null;
};

/**
 * ポータルの状態に当てはまる段階を返す。
 * 各段階の portal_keywords のうち状態に含まれる語を探し、最も長く一致した語を持つ段階を採用する
 * （「不採択」と「採択」が両方当てはまるときは「不採択」を優先するため）。
 */
export function stageForPortalStatus<T extends StageRule>(stages: T[], portalStatus: string | null | undefined): T | null {
  if (!portalStatus) return null;
  let best: { stage: T; len: number } | null = null;
  for (const s of stages) {
    for (const kw of s.portal_keywords ?? []) {
      const k = kw.trim();
      if (!k || !portalStatus.includes(k)) continue;
      if (!best || k.length > best.len || (k.length === best.len && s.sort_order > best.stage.sort_order)) {
        best = { stage: s, len: k.length };
      }
    }
  }
  return best?.stage ?? null;
}

/** 節目に対応する段階（同じ節目が複数あれば並び順が先のもの） */
export function stageForMilestone<T extends StageRule>(stages: T[], milestone: Milestone): T | null {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order).find((s) => s.milestone === milestone) ?? null;
}

/** 自動で動かすのは先の段階へだけ（今の段階が不明なら動かしてよい） */
export function isForward(current: StageRule | null | undefined, next: StageRule): boolean {
  if (!current) return true;
  return next.sort_order > current.sort_order;
}
