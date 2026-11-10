import { appBaseUrl } from '@/lib/utils/appUrl';
import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/vendors/crypto';
import { auditLog } from '@/lib/utils/logger';
import type { PortalSyncRun, VendorContact } from '@/lib/supabase/types';
import { scrapePortalCases, PortalError } from './scraper';
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
import { applyPortalDetailToCase, detailFromRaw } from './applyDetail';

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

/** 状態が変わった案件を社内用グループ向けの 1 通にまとめる */
export function buildChangeSummary(results: SyncResult[]): string | null {
  const caseChanges = results.flatMap((r) => r.caseChanges);
  const others = results.flatMap((r) => r.portalChanges).filter(
    (p) => !caseChanges.some((c) => c.applicationNo === p.application_no),
  );
  if (caseChanges.length === 0 && others.length === 0) return null;
  const lines = ['【ポータル同期】状態が変わった案件'];
  for (const c of caseChanges.slice(0, 30)) {
    lines.push(`・${c.companyName ?? c.applicationNo}: ${c.from ?? '（なし）'} → ${c.to ?? '（なし）'}`);
  }
  if (caseChanges.length > 30) lines.push(`ほか ${caseChanges.length - 30}件`);
  if (others.length > 0) {
    lines.push('', `案件に紐づいていない変化: ${others.length}件（新規 ${others.filter((o) => o.isNew).length}件）`);
  }
  const appUrl = appBaseUrl();
  if (appUrl) lines.push('', `${appUrl}/admin/portal`);
  return lines.join('\n');
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

  const { data: run } = await supabase
    .from('portal_sync_runs')
    .insert({ vendor_contact_id: vendorId, trigger, status: 'running' })
    .select()
    .single();
  const runId = (run as PortalSyncRun).id;

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

    const { rows, details, warnings, yearsSearched } = await scrapePortalCases(vendor.portal_login_id, password, {
      // 詳細がまだ無い・状態が変わった・30日以上たった案件だけ、1回 10件まで
      pickDetails: (list) =>
        list
          .filter((r) => linkedNos.has(r.application_no))
          .filter((r) => {
            const prev = prevByNo.get(r.application_no);
            const d = detailFromRaw(prev?.raw);
            if (!d) return true;
            if ((prev?.status ?? '') !== (r.status ?? '')) return true;
            return Date.now() - new Date(d.fetched_at).getTime() > 30 * 86400_000;
          })
          .map((r) => r.application_no)
          .slice(0, 10),
      // 3社続けても cron の上限（300秒）に収まるよう、1社あたり30秒まで
      detailBudgetMs: 30_000,
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
    }

    await supabase
      .from('portal_sync_runs')
      .update({
        status: 'success',
        finished_at: now,
        rows_count: rows.length,
        matched_count: matched,
        // 成功扱いだが一部年度で失敗した場合はここに残す（画面で注意表示）
        error: warnings.length > 0 ? `一部の年度で失敗: ${warnings.join(' / ')}`.slice(0, 2000) : null,
      })
      .eq('id', runId);

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
