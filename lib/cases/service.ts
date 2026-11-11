import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, Stage, Tool, CheckItemDef } from '@/lib/supabase/types';
import { notifyCustomerGroup } from '@/lib/line/notify';
import {
  MILESTONE_COLUMNS,
  MILESTONE_LABELS,
  SYSTEM_CHECK_KEYS,
  type ActorType,
  type Milestone,
} from './constants';
import { billingAmount, computeFees, isBillingDue, type MilestoneDates } from './fee';
import { isForward, stageForMilestone, stageForPortalStatus } from './stageRules';

// 案件の段階・節目・チェック・フィー・請求予定をまとめて動かす処理。
// 変更はすべて status_history に残す。

export type Actor = { type: ActorType; name?: string | null };

/** 日本時間の今日（YYYY-MM-DD） */
export function jstToday(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

export async function listStages(): Promise<Stage[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('stages').select('*').order('sort_order');
  return (data ?? []) as Stage[];
}

export async function addHistory(
  applicationId: string,
  field: string,
  from: unknown,
  to: unknown,
  actor: Actor,
): Promise<void> {
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  if (str(from) === str(to)) return;
  const supabase = createServiceRoleClient();
  await supabase.from('status_history').insert({
    application_id: applicationId,
    field,
    from_value: str(from),
    to_value: str(to),
    actor_type: actor.type,
    actor_name: actor.name ?? null,
  });
}

async function getApp(applicationId: string): Promise<Application | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
  return (data as Application | null) ?? null;
}

function milestoneDates(app: Application): MilestoneDates {
  return {
    contract_signed: app.contract_signed_at,
    documents_submitted: app.documents_submitted_at,
    applied: app.applied_at,
    adopted: app.adopted_at,
    grant_decided: app.grant_decided_at,
    subsidy_paid: app.subsidy_paid_at,
  };
}

/** その段階に入ったときのチェック項目を案件に追加する（既にあれば何もしない） */
export async function ensureStageChecks(applicationId: string, stageId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: defs } = await supabase
    .from('check_item_defs')
    .select('*')
    .eq('stage_id', stageId)
    .eq('active', true);
  for (const d of (defs ?? []) as CheckItemDef[]) {
    await addCheck(applicationId, d);
  }
}

async function addCheck(applicationId: string, def: CheckItemDef): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('case_checks')
    .upsert(
      {
        application_id: applicationId,
        check_item_def_id: def.id,
        due_on: def.due_days != null ? jstToday(def.due_days) : null,
      },
      { onConflict: 'application_id,check_item_def_id', ignoreDuplicates: true },
    )
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}

/** システム項目（請求書発行など）を立てる */
export async function ensureSystemCheck(applicationId: string, systemKey: string, actor: Actor): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('check_item_defs').select('*').eq('system_key', systemKey).maybeSingle();
  if (!data) return;
  const def = data as CheckItemDef;
  if (await addCheck(applicationId, def)) {
    await addHistory(applicationId, 'check', null, `${def.name}（追加）`, actor);
  }
}

/** チェック項目の完了・未完了 */
export async function setCheckDone(caseCheckId: string, done: boolean, actor: Actor): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('case_checks')
    .select('*, def:check_item_defs(name)')
    .eq('id', caseCheckId)
    .maybeSingle();
  if (!data) throw new Error('チェック項目が見つかりません');
  await supabase
    .from('case_checks')
    .update({ done_at: done ? new Date().toISOString() : null, done_by: done ? (actor.name ?? null) : null })
    .eq('id', caseCheckId);
  const name = (data.def as { name: string } | null)?.name ?? 'チェック';
  await addHistory(data.application_id as string, 'check', `${name}: ${data.done_at ? '完了' : '未完了'}`, `${name}: ${done ? '完了' : '未完了'}`, actor);
}

/**
 * 段階を変える。段階に節目があれば日時を記録し、段階のチェック項目を追加し、
 * 顧客通知がオンなら顧客グループに定型文を送る。最後にフィーと請求予定を計算し直す。
 */
export async function changeStage(applicationId: string, stageId: string, actor: Actor): Promise<void> {
  const supabase = createServiceRoleClient();
  const [app, stages] = await Promise.all([getApp(applicationId), listStages()]);
  if (!app) throw new Error('案件が見つかりません');
  const next = stages.find((s) => s.id === stageId);
  if (!next) throw new Error('段階が見つかりません');
  if (app.stage_id === stageId) return;
  const prev = stages.find((s) => s.id === app.stage_id) ?? null;

  const update: Record<string, unknown> = { stage_id: stageId };
  if (next.milestone) {
    const col = MILESTONE_COLUMNS[next.milestone];
    if (!(app as unknown as Record<string, unknown>)[col]) update[col] = new Date().toISOString();
  }
  await supabase.from('applications').update(update).eq('id', applicationId);
  await addHistory(applicationId, 'stage', prev?.name ?? null, next.name, actor);
  if (next.milestone && update[MILESTONE_COLUMNS[next.milestone]]) {
    await addHistory(applicationId, `milestone:${next.milestone}`, null, MILESTONE_LABELS[next.milestone], actor);
  }
  await ensureStageChecks(applicationId, stageId);

  if (next.notify_customer && next.customer_message) {
    const text = next.customer_message
      .replaceAll('{会社名}', app.company_name ?? '')
      .replaceAll('{段階}', next.name);
    await notifyCustomerGroup(applicationId, `stage:${next.name}`, text);
  }

  await recalcFeesAndBilling(applicationId, actor);
}

/**
 * 節目に達したことを記録する（日時が空のときだけ）。
 * その節目を持つ段階が今より先にあれば、そこへ自動で進める。
 */
export async function reachMilestone(
  applicationId: string,
  milestone: Milestone,
  actor: Actor,
  at: string = new Date().toISOString(),
): Promise<void> {
  const supabase = createServiceRoleClient();
  const [app, stages] = await Promise.all([getApp(applicationId), listStages()]);
  if (!app) return;
  const col = MILESTONE_COLUMNS[milestone];
  if (!(app as unknown as Record<string, unknown>)[col]) {
    await supabase.from('applications').update({ [col]: at }).eq('id', applicationId);
    await addHistory(applicationId, `milestone:${milestone}`, null, MILESTONE_LABELS[milestone], actor);
  }
  const target = stageForMilestone(stages, milestone);
  const current = stages.find((s) => s.id === app.stage_id) ?? null;
  if (target && isForward(current, target)) {
    await changeStage(applicationId, target.id, actor);
  } else {
    await recalcFeesAndBilling(applicationId, actor);
  }
}

/** 節目の日時を手で直す（空にもできる） */
export async function setMilestoneDate(
  applicationId: string,
  milestone: Milestone,
  at: string | null,
  actor: Actor,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const app = await getApp(applicationId);
  if (!app) throw new Error('案件が見つかりません');
  const col = MILESTONE_COLUMNS[milestone];
  const before = (app as unknown as Record<string, string | null>)[col];
  await supabase.from('applications').update({ [col]: at }).eq('id', applicationId);
  await addHistory(applicationId, `milestone:${milestone}`, jstDate(before), jstDate(at), actor);
  // 日付を入れたら、その節目の段階が今より先なら進める（消したときは段階を戻さない）
  if (at) {
    const stages = await listStages();
    const target = stageForMilestone(stages, milestone);
    const { data } = await supabase.from('applications').select('stage_id').eq('id', applicationId).single();
    const current = stages.find((s) => s.id === data?.stage_id) ?? null;
    if (target && isForward(current, target)) {
      await changeStage(applicationId, target.id, actor);
      return;
    }
  }
  await recalcFeesAndBilling(applicationId, actor);
}

/** ISO 日時 → 日本時間の YYYY-MM-DD（履歴の表示用） */
function jstDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
}

/** ポータルの状態に合わせて段階を進める（先へだけ） */
export async function applyPortalStatus(applicationId: string, portalStatus: string | null): Promise<void> {
  const [app, stages] = await Promise.all([getApp(applicationId), listStages()]);
  if (!app) return;
  const target = stageForPortalStatus(stages, portalStatus);
  if (!target) return;
  const current = stages.find((s) => s.id === app.stage_id) ?? null;
  if (isForward(current, target)) {
    await changeStage(applicationId, target.id, { type: 'portal' });
  }
}

/**
 * フィー（見込み・確定）を計算し直し、請求タイミングに達していれば請求予定を作る。
 * 請求書を発行する前なら、請求予定の金額も最新に合わせる。
 */
export async function recalcFeesAndBilling(applicationId: string, actor: Actor): Promise<void> {
  const supabase = createServiceRoleClient();
  const app = await getApp(applicationId);
  if (!app) return;
  let tool: Tool | null = null;
  if (app.tool_id) {
    const { data } = await supabase.from('tools').select('*').eq('id', app.tool_id).maybeSingle();
    tool = (data as Tool | null) ?? null;
  }
  const dates = milestoneDates(app);
  const fees = computeFees(tool, app.subsidy_amount, dates);
  if (fees.fee_estimated !== app.fee_estimated || fees.fee_confirmed !== app.fee_confirmed) {
    await supabase.from('applications').update(fees).eq('id', applicationId);
    await addHistory(applicationId, 'fee_estimated', app.fee_estimated, fees.fee_estimated, { type: 'system' });
    await addHistory(applicationId, 'fee_confirmed', app.fee_confirmed, fees.fee_confirmed, { type: 'system' });
  }

  if (!tool || !isBillingDue(tool.billing_timing, dates)) return;
  const amount = billingAmount(fees, tool);
  const { data: existing } = await supabase
    .from('billing_schedules')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();
  if (!existing) {
    const at = dates[tool.billing_timing];
    const occurred = at ? new Date(new Date(at).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : jstToday();
    await supabase.from('billing_schedules').insert({
      application_id: applicationId,
      amount,
      trigger: tool.billing_timing,
      occurred_on: occurred,
    });
    await addHistory(applicationId, 'billing', null, `請求予定を作成（${amount != null ? amount.toLocaleString() + '円' : '金額未定'}）`, actor);
    await ensureSystemCheck(applicationId, SYSTEM_CHECK_KEYS.invoiceIssue, actor);
  } else if (existing.trigger !== 'manual' && !existing.invoice_issued_on && existing.amount !== amount) {
    // 手で作った請求予定の金額は、自動の計算で上書きしない
    await supabase
      .from('billing_schedules')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    await addHistory(applicationId, 'billing_amount', existing.amount, amount, { type: 'system' });
  }
}

/**
 * 請求予定を手で作る（請求タイミングを待たずに請求したいとき）。すでにあれば作らない。
 * 金額を省くと、フィー確定額 → 見込み額の順に使う。
 */
export async function createManualBilling(
  applicationId: string,
  input: { amount: number | null; occurred_on: string | null },
  actor: Actor,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from('billing_schedules').select('id').eq('application_id', applicationId).maybeSingle();
  if (existing) return { ok: false, reason: 'この案件にはもう請求予定があります（売上・請求の画面で直せます）' };
  const { data: app } = await supabase.from('applications').select('fee_confirmed, fee_estimated').eq('id', applicationId).maybeSingle();
  if (!app) return { ok: false, reason: '案件が見つかりません' };
  const amount = input.amount ?? (app.fee_confirmed as number | null) ?? (app.fee_estimated as number | null) ?? null;
  const { error } = await supabase.from('billing_schedules').insert({
    application_id: applicationId,
    amount,
    trigger: 'manual',
    occurred_on: input.occurred_on ?? jstToday(),
  });
  if (error) return { ok: false, reason: error.message };
  await addHistory(applicationId, 'billing', null, `請求予定を手で作成（${amount != null ? amount.toLocaleString() + '円' : '金額未定'}）`, actor);
  await ensureSystemCheck(applicationId, SYSTEM_CHECK_KEYS.invoiceIssue, actor);
  return { ok: true };
}

/** 最初の段階（並び順が最小） */
export async function initialStageId(): Promise<string | null> {
  const stages = await listStages();
  return stages[0]?.id ?? null;
}
