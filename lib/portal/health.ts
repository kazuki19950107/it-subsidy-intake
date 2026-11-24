/**
 * ポータル同期が止まっていないかの判定（画面の上に赤く出すため）。
 * 同期は 1 日 2 回（朝・昼）、まとめは 08:00 と 17:00。1 回だけの失敗はまとめの LINE で分かるので、
 * ここでは「2 回続けて取れていない」「まとめが送られていない」ときだけ知らせる。
 * LINE が届かない（合言葉のずれ・障害）ときでも、画面を開けば気づけるようにするためのもの。
 */

/** この時間より長く取れていない会社を「止まっている」とみなす（1 日 2 回なので、2 回分＋余裕） */
export const VENDOR_STALE_HOURS = 26;
/** まとめがこの時間より長く送られていなければ知らせる（17:00 → 翌 08:00 の 15 時間＋余裕） */
export const REPORT_STALE_HOURS = 17;

export type HealthInput = {
  vendors: Array<{ id: string; name: string }>;
  /** ベンダーの id → 最後に成功した時刻 */
  lastSuccess: Record<string, string | undefined>;
  /** 最後にまとめを送った時刻（まだ一度も無ければ null） */
  lastReportAt: string | null;
  now: Date;
};

export type PortalHealth = {
  ok: boolean;
  /** 全社が止まっている（同期そのものが動いていない） */
  allStale: boolean;
  staleVendors: Array<{ name: string; lastSuccess: string | null }>;
  /** まとめが送られていない */
  reportStale: boolean;
  /** いちばん新しい成功の時刻 */
  latestSuccess: string | null;
};

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3600_000;

export function portalHealth({ vendors, lastSuccess, lastReportAt, now }: HealthInput): PortalHealth {
  const staleVendors = vendors
    .filter((v) => {
      const t = lastSuccess[v.id];
      return !t || hoursSince(t, now) > VENDOR_STALE_HOURS;
    })
    .map((v) => ({ name: v.name, lastSuccess: lastSuccess[v.id] ?? null }));
  const times = Object.values(lastSuccess).filter((t): t is string => !!t).sort();
  const latestSuccess = times.length > 0 ? times[times.length - 1] : null;
  const reportStale = !!lastReportAt && hoursSince(lastReportAt, now) > REPORT_STALE_HOURS;
  const allStale = vendors.length > 0 && staleVendors.length === vendors.length;
  return {
    ok: staleVendors.length === 0 && !reportStale,
    allStale,
    staleVendors,
    reportStale,
    latestSuccess,
  };
}
