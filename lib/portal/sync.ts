import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/vendors/crypto';
import { auditLog } from '@/lib/utils/logger';
import type { PortalSyncRun, VendorContact } from '@/lib/supabase/types';
import { scrapePortalCases, PortalError } from './scraper';
import { MANUAL_GAP_MIN, type LastRun } from './report';
import {
  corporateNumberFromRaw,
  diffPortalRows,
  matchPortalRow,
  type MatchableCase,
  type PortalStatusChange,
} from './diff';
import { addHistory, applyPortalStatus } from '@/lib/cases/service';
import { roundFromPortal } from './match';
import type { PortalDetail } from './detail';
import type { RunChanges } from './report';
import { applyPortalDetailToCase, detailFromRaw } from './applyDetail';
import { ensureVendorContract } from '@/lib/vendorDocs/service';

export type CaseStatusChange = {
  applicationId: string;
  companyName: string | null;
  applicationNo: string;
  from: string | null;
  to: string | null;
};

export type SyncResult = {
  runId: string;
  vendorId: string;
  vendorName: string;
  rows: number;
  matched: number;
  durationMs: number;
  warnings: string[];
  /** ポータル上で状態が変わった・新しく出てきた案件（案件に紐づかないものも含む） */
  portalChanges: PortalStatusChange[];
  /** 当システムの案件で、ポータルの状態が変わったもの */
  caseChanges: CaseStatusChange[];
};

/** 同期は 1 回 300 秒で打ち切られる。これより古い「実行中」は止まったものとみなす */
const STALE_RUN_MS = 6 * 60_000; // 1 回は SCRAPE_TIME_BUDGET_MS（230 秒）で自分からやめる

/** ほかの同期が動いているため始めなかったとき */
export class PortalSyncBusyError extends Error {
  constructor(public readonly runningVendor: string | null) {
    super(
      `ほかの会社${runningVendor ? `（${runningVendor}）` : ''}を同期中です。同時に動かすと失敗するので、終わってから（1〜2分後）もう一度押してください。`,
    );
    this.name = 'PortalSyncBusyError';
  }
}

/** ひとつ前の同期を始めてからの間が短すぎるとき（ポータルが続けてのログインを止めるため） */
export class PortalSyncTooSoonError extends PortalSyncBusyError {
  constructor(waitMin: number) {
    super(null);
    this.message = `ポータルは続けてログインすると受け付けなくなるので、あと${waitMin}分ほどあけてから押してください。`;
    this.name = 'PortalSyncTooSoonError';
  }
}

/** すべての会社・すべての種類のうち、いちばん新しい同期 */
export async function latestRun(): Promise<LastRun | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('portal_sync_runs')
    .select('started_at, status, error')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LastRun | null) ?? null;
}

/** 300 秒の上限で打ち切られて「実行中」のまま残った記録を失敗にする */
export async function cleanupStaleRuns(): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from('portal_sync_runs')
    .update({
      status: 'error',
      finished_at: new Date().toISOString(),
      error: '時間切れで止まりました（1回の上限300秒をこえた）。もう一度同期してください。',
    })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - STALE_RUN_MS).toISOString());
}

/**
 * ブラウザを同時に複数動かすと、メモリ不足や起動の取り合いで失敗する。
 * 自分の記録を入れたあと、動いている同期のうち最も早く始めたものが自分でなければ譲る。
 * （同時に押されても、どちらか 1 つだけが進む）
 */
async function acquireSyncSlot(runId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('portal_sync_runs')
    .select('id, started_at, vendor_contacts(name)')
    .eq('status', 'running')
    .gte('started_at', new Date(Date.now() - STALE_RUN_MS).toISOString())
    .order('started_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);
  const first = (data ?? [])[0] as { id: string; vendor_contacts: { name: string } | { name: string }[] | null } | undefined;
  if (!first || first.id === runId) return;
  await supabase.from('portal_sync_runs').delete().eq('id', runId);
  const v = first.vendor_contacts;
  throw new PortalSyncBusyError((Array.isArray(v) ? v[0]?.name : v?.name) ?? null);
}

/** ポータルの認証情報を持つ有効なベンダー一覧 */
export async function listSyncableVendors(): Promise<VendorContact[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('vendor_contacts')
    .select('*')
    .eq('active', true)
    .not('portal_login_id', 'is', null)
    .not('portal_password_enc', 'is', null)
    .order('name');
  return (data ?? []) as VendorContact[];
}

/**
 * 1 ベンダー分の同期。
 * 1) ログインして全件取得 2) portal_cases に upsert 3) 交付申請番号が一致する申請に書き戻し
 */
export async function syncVendorPortal(
  vendorId: string,
  trigger: 'manual' | 'cron',
): Promise<SyncResult> {
  const supabase = createServiceRoleClient();
  const startedAt = Date.now();

  const { data: vendorRow } = await supabase
    .from('vendor_contacts')
    .select('*')
    .eq('id', vendorId)
    .maybeSingle();
  const vendor = vendorRow as VendorContact | null;
  if (!vendor) throw new Error('ベンダーが見つかりません');
  if (!vendor.portal_login_id || !vendor.portal_password_enc) {
    throw new Error('このベンダーにはポータルのログインIDとパスワードが登録されていません');
  }

  await cleanupStaleRuns();
  if (trigger === 'manual') {
    const last = await latestRun();
    if (last && last.status !== 'running') {
      const elapsedMin = (Date.now() - new Date(last.started_at).getTime()) / 60_000;
      if (elapsedMin < MANUAL_GAP_MIN) throw new PortalSyncTooSoonError(Math.ceil(MANUAL_GAP_MIN - elapsedMin));
    }
  }
  const { data: run } = await supabase
    .from('portal_sync_runs')
    .insert({ vendor_contact_id: vendorId, trigger, status: 'running' })
    .select()
    .single();
  const runId = (run as PortalSyncRun).id;
  await acquireSyncSlot(runId);

  try {
    const password = decryptSecret(vendor.portal_password_enc);

    // 前回の取得結果（このベンダー分）。状態の差分と、詳細（ツール・金額）を読み直すかの判断に使う
    const { data: prevRows } = await supabase
      .from('portal_cases')
      .select('application_no, status, raw')
      .eq('vendor_contact_id', vendorId);
    const prevByNo = new Map(
      ((prevRows ?? []) as Array<{ application_no: string; status: string | null; raw: unknown }>).map((r) => [r.application_no, r]),
    );
    const previous = new Map<string, string | null>(Array.from(prevByNo.values()).map((r) => [r.application_no, r.status]));

    // 案件に紐付いている申請番号。これらは詳細（交付申請 確認）も読む
    const { data: linkedRows } = await supabase
      .from('applications')
      .select('portal_application_no')
      .not('portal_application_no', 'is', null);
    const linkedNos = new Set(((linkedRows ?? []) as Array<{ portal_application_no: string }>).map((r) => r.portal_application_no));

    const { rows, details, warnings, detailNotes, yearsSearched } = await scrapePortalCases(vendor.portal_login_id, password, {
      // 紐付いた案件のうち、詳細がまだ無い・状態が変わった・30日以上たったものだけ、1回 10件まで
      shouldReadDetail: (r) => {
        if (!linkedNos.has(r.application_no)) return false;
        const prev = prevByNo.get(r.application_no);
        const d = detailFromRaw(prev?.raw);
        if (!d) return true;
        // 会社名・住所を読むようにする前に読んだ詳細は、もう一度読む
        if (!('basic_text' in d)) return true;
        if ((prev?.status ?? '') !== (r.status ?? '')) return true;
        return Date.now() - new Date(d.fetched_at).getTime() > 30 * 86400_000;
      },
      maxDetails: 10,
      // 3社続けても cron の上限（300秒）に収まるよう、1社あたり40秒まで
      detailBudgetMs: 40_000,
    });
    const now = new Date().toISOString();
    const portalChanges = diffPortalRows(previous, rows);
    const detailOf = (no: string): PortalDetail | null => details[no] ?? detailFromRaw(prevByNo.get(no)?.raw);

    if (rows.length > 0) {
      const payload = rows.map((r) => ({
        vendor_contact_id: vendorId,
        application_no: r.application_no,
        applicant_name: r.applicant_name,
        prefecture: r.prefecture,
        round: r.round,
        application_type: r.application_type,
        status: r.status,
        status_updated_on: r.status_updated_on,
        handler_name: r.handler_name,
        // 詳細は読み直したときだけ更新し、それ以外は前回の内容を残す
        raw: { cells: r.raw, fiscal_year: r.fiscal_year, detail: detailOf(r.application_no) },
        last_seen_at: now,
      }));
      // 500 件ずつ upsert
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from('portal_cases')
          .upsert(payload.slice(i, i + 500), { onConflict: 'vendor_contact_id,application_no' });
        if (error) throw new Error(`portal_cases の保存に失敗: ${error.message}`);
      }
    }

    // 案件と照合する: 申請番号 → 法人番号（一致すれば申請番号を自動で設定）→ 会社名（候補のみ・詳細画面で人が確定）
    const { data: apps } = await supabase
      .from('applications')
      .select('id, portal_application_no, corporate_number, company_name, applicant_name, portal_status, round');
    const cases = (apps ?? []) as Array<
      MatchableCase & { portal_status: string | null; round: number | null }
    >;
    let matched = 0;
    const caseChanges: CaseStatusChange[] = [];
    const seenNo = new Set<string>();
    for (const r of rows) {
      if (seenNo.has(r.application_no)) continue;
      seenNo.add(r.application_no);
      const m = matchPortalRow(
        { application_no: r.application_no, applicant_name: r.applicant_name, corporate_number: corporateNumberFromRaw(r.raw) },
        cases,
      );
      if (m.kind !== 'application_no' && m.kind !== 'corporate_number') continue;
      const c = cases.find((x) => x.id === m.caseId)!;
      matched++;
      const update: Record<string, unknown> = {
        portal_status: r.status,
        portal_status_updated_on: r.status_updated_on,
        portal_synced_at: now,
      };
      // 回次が空欄なら、ポータルの募集回を入れる
      const portalRound = roundFromPortal(r.round);
      if (c.round == null && portalRound != null) {
        update.round = portalRound;
        c.round = portalRound;
        await addHistory(c.id, '回次', null, portalRound, { type: 'portal' });
      }
      if (m.kind === 'corporate_number') {
        update.portal_application_no = r.application_no;
        c.portal_application_no = r.application_no;
        await addHistory(c.id, 'portal_application_no', null, r.application_no, { type: 'portal', name: '法人番号で照合' });
      }
      await supabase.from('applications').update(update).eq('id', c.id);
      if ((c.portal_status ?? '') !== (r.status ?? '')) {
        await addHistory(c.id, 'portal_status', c.portal_status, r.status, { type: 'portal' });
        caseChanges.push({
          applicationId: c.id,
          companyName: c.company_name ?? c.applicant_name ?? r.applicant_name,
          applicationNo: r.application_no,
          from: c.portal_status,
          to: r.status,
        });
        c.portal_status = r.status;
        await applyPortalStatus(c.id, r.status);
      }
      // 詳細（ツール・補助金申請額・法人番号・代表者）で案件の空欄を埋める
      const d = detailOf(r.application_no);
      if (d) await applyPortalDetailToCase(c.id, d);
      // 採択後の契約書（ベンダー → お客様）を、条件がそろっていれば自動で作る
      await ensureVendorContract(c.id).catch((e) => console.error('[portal sync] vendor contract', (e as Error).message));
    }

    const done = {
      status: 'success',
      finished_at: now,
      rows_count: rows.length,
      matched_count: matched,
      // 成功扱いだが一部年度で失敗した場合はここに残す（画面で注意表示）
      error:
        [warnings.length > 0 ? `一部の年度で失敗: ${warnings.join(' / ')}` : null, ...detailNotes]
          .filter(Boolean)
          .join(' / ')
          .slice(0, 2000) || null,
    };
    // 毎朝のまとめ（1通）を作るため、この回の変化を残す
    const others = portalChanges.filter((p) => !caseChanges.some((c) => c.applicationNo === p.application_no));
    const changes: RunChanges = { caseChanges, others: others.length, othersNew: others.filter((o) => o.isNew).length };
    const { error: saveError } = await supabase.from('portal_sync_runs').update({ ...done, changes }).eq('id', runId);
    if (saveError) {
      // changes 列がまだ無い（DB の変更前）ときも、成功の記録だけは残す
      await supabase.from('portal_sync_runs').update(done).eq('id', runId);
    }

    await auditLog({
      actorType: trigger === 'cron' ? 'system' : 'admin',
      action: 'portal.synced',
      targetType: 'vendor_contact',
      targetId: vendorId,
      metadata: {
        rows: rows.length,
        matched,
        trigger,
        yearsSearched,
        warnings,
        portalChanges: portalChanges.length,
        caseChanges: caseChanges.length,
      },
    });

    return {
      runId,
      vendorId,
      vendorName: vendor.name,
      rows: rows.length,
      matched,
      durationMs: Date.now() - startedAt,
      warnings,
      portalChanges,
      caseChanges,
    };
  } catch (e) {
    const message =
      e instanceof PortalError ? `[${e.stage}] ${e.message}` : (e as Error).message ?? String(e);
    await supabase
      .from('portal_sync_runs')
      .update({ status: 'error', finished_at: new Date().toISOString(), error: message.slice(0, 2000) })
      .eq('id', runId);
    await auditLog({
      actorType: trigger === 'cron' ? 'system' : 'admin',
      action: 'portal.sync_failed',
      targetType: 'vendor_contact',
      targetId: vendorId,
      metadata: { error: message.slice(0, 500), trigger },
    });
    throw new Error(message);
  }
}

/** 最新の同期実行をベンダーごとに 1 件ずつ返す */
export async function latestRunsByVendor(): Promise<Record<string, PortalSyncRun>> {
  await cleanupStaleRuns();
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('portal_sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(200);
  const out: Record<string, PortalSyncRun> = {};
  for (const r of (data ?? []) as PortalSyncRun[]) {
    if (!out[r.vendor_contact_id]) out[r.vendor_contact_id] = r;
  }
  return out;
}
