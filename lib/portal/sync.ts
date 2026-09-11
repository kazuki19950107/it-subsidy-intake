import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/vendors/crypto';
import { auditLog } from '@/lib/utils/logger';
import type { PortalSyncRun, VendorContact } from '@/lib/supabase/types';
import { scrapePortalCases, PortalError } from './scraper';

export type SyncResult = {
  runId: string;
  vendorId: string;
  vendorName: string;
  rows: number;
  matched: number;
  durationMs: number;
};

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
    const rows = await scrapePortalCases(vendor.portal_login_id, password);
    const now = new Date().toISOString();

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
        raw: { cells: r.raw, fiscal_year: r.fiscal_year },
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

    // 交付申請番号が一致する申請にステータスを書き戻す
    const byNo = new Map(rows.map((r) => [r.application_no, r]));
    const { data: apps } = await supabase
      .from('applications')
      .select('id, portal_application_no')
      .not('portal_application_no', 'is', null);
    let matched = 0;
    for (const a of (apps ?? []) as Array<{ id: string; portal_application_no: string }>) {
      const r = byNo.get(a.portal_application_no);
      if (!r) continue;
      matched++;
      await supabase
        .from('applications')
        .update({
          portal_status: r.status,
          portal_status_updated_on: r.status_updated_on,
          portal_synced_at: now,
        })
        .eq('id', a.id);
    }

    await supabase
      .from('portal_sync_runs')
      .update({
        status: 'success',
        finished_at: now,
        rows_count: rows.length,
        matched_count: matched,
      })
      .eq('id', runId);

    await auditLog({
      actorType: trigger === 'cron' ? 'system' : 'admin',
      action: 'portal.synced',
      targetType: 'vendor_contact',
      targetId: vendorId,
      metadata: { rows: rows.length, matched, trigger },
    });

    return {
      runId,
      vendorId,
      vendorName: vendor.name,
      rows: rows.length,
      matched,
      durationMs: Date.now() - startedAt,
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
