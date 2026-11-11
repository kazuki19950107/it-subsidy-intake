import { appBaseUrl } from '@/lib/utils/appUrl';
import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, Contract, Tool } from '@/lib/supabase/types';
import { sha256 } from '@/lib/utils/hash';
import { BILLING_TIMING_LABELS } from '@/lib/cases/constants';
import { addHistory, reachMilestone } from '@/lib/cases/service';
import {
  CONTRACT_TEMPLATE,
  CONTRACT_TITLE,
  TEMPLATE_VERSION,
  alignConsentHtml,
  fillConsentParty,
  readConsentParty,
  renderContractHtml,
  warekiDate,
  type ConsentParty,
  type ContractVars,
} from './template';
import { contractPdfHtml, renderPdf } from './pdf';
import { noTimestamp, type TimestampProvider } from './timestamp';

export const AGENT_NAME = process.env.AGENT_COMPANY_NAME || 'Assemble';

/** 作れない理由（画面にそのまま出す） */
export class ContractError extends Error {}

/** 画面や文言で使う呼び名（同意書 / 契約書） */
export function contractLabel(c: Pick<Contract, 'kind'>): string {
  return (c.kind ?? 'consent') === 'vendor_client' ? '契約書' : '同意書';
}

/** PDF の「乙」 */
export function partyBName(c: Pick<Contract, 'party_b_name'>): string {
  return c.party_b_name || AGENT_NAME;
}

function feeDescription(tool: Tool | null): string {
  if (!tool) return '別途定める報酬を';
  const amount =
    tool.fee_method === 'fixed'
      ? `${Number(tool.fee_fixed ?? 0).toLocaleString()}円（税別）`
      : `交付された補助金額の${Math.round(Number(tool.fee_rate ?? 0) * 1000) / 10}%に相当する額（税別）`;
  return `${amount}を、${BILLING_TIMING_LABELS[tool.billing_timing]}に乙の請求に基づき`;
}

export async function contractVarsFor(app: Application): Promise<ContractVars> {
  const supabase = createServiceRoleClient();
  let tool: Tool | null = null;
  if (app.tool_id) {
    const { data } = await supabase.from('tools').select('*').eq('id', app.tool_id).maybeSingle();
    tool = (data as Tool | null) ?? null;
  }
  // 宛名（と PDF の「乙」）は案件のベンダー（正式な会社名）。ベンダーが無いときは作らない
  let addressee = '';
  if (app.vendor_contact_id) {
    const { data: v } = await supabase.from('vendor_contacts').select('name, legal_name').eq('id', app.vendor_contact_id).maybeSingle();
    if (v) addressee = (v.legal_name as string | null) || (v.name as string);
  }
  if (!addressee) throw new ContractError('同意書の宛名になるベンダーを、案件の情報で選んでから作ってください');
  const now = new Date();
  return {
    addressee,
    issued_on_wareki: warekiDate(now),
    fiscal_year: String(new Date(now.getTime() + 9 * 3600_000).getUTCFullYear()),
    company_name: app.company_name ?? '',
    representative_name: app.representative_name ?? '',
    address: app.address ?? '',
    corporate_number: app.corporate_number ?? '',
    tool_name: tool ? `${tool.name}（${tool.code}）` : '',
    round: app.round != null ? `${app.round}次` : '',
    fee_description: feeDescription(tool),
    issued_on: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    agent_name: AGENT_NAME,
  };
}

/**
 * 案件の同意書を作る（または作り直す）。未署名の既存の同意書は無効にする。
 * 締結済みの同意書があるときは作らない。
 */
export async function createContractForCase(applicationId: string): Promise<Contract | null> {
  const supabase = createServiceRoleClient();
  const { data: appRow } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
  const app = appRow as Application | null;
  if (!app) throw new Error('案件が見つかりません');

  const { data: existing } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('application_id', applicationId)
    .eq('kind', 'consent');
  if ((existing ?? []).some((c) => c.status === 'signed')) return null;
  const openIds = (existing ?? []).filter((c) => c.status !== 'void').map((c) => c.id as string);
  if (openIds.length > 0) await supabase.from('contracts').update({ status: 'void' }).in('id', openIds);

  const vars = await contractVarsFor(app);
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      application_id: applicationId,
      token: randomBytes(32).toString('base64url'),
      status: 'sent',
      title: CONTRACT_TITLE,
      body_html: alignConsentHtml(renderContractHtml(CONTRACT_TEMPLATE, vars)),
      template_version: TEMPLATE_VERSION,
      // PDF の「乙」は宛名と同じ会社
      party_b_name: vars.addressee,
    })
    .select()
    .single();
  if (error) throw new Error(`同意書の作成に失敗しました: ${error.message}`);
  return data as Contract;
}

export async function getContractByToken(token: string): Promise<Contract | null> {
  if (!token || token.length < 20) return null;
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('contracts').select('*').eq('token', token).maybeSingle();
  return (data as Contract | null) ?? null;
}

export async function markViewed(contract: Contract): Promise<void> {
  if (contract.viewed_at || contract.status !== 'sent') return;
  const supabase = createServiceRoleClient();
  await supabase.from('contracts').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', contract.id);
}

export type SignInput = {
  signerName: string;
  signerTitle: string | null;
  signerEmail: string | null;
  method: 'typed' | 'drawn';
  signatureImage: string | null;
  ip: string | null;
  userAgent: string | null;
  /** 同意書の「住所・名称・代表者」（お客様が署名のときに入れる） */
  party?: ConsentParty | null;
};

/**
 * 署名して締結する。署名済み PDF を作って保存し、SHA-256 を記録する。
 * 認定タイムスタンプは provider を差し替えれば付けられる（既定は付けない）。
 */
export async function signContract(
  contract: Contract,
  input: SignInput,
  timestamp: TimestampProvider = noTimestamp,
): Promise<Contract> {
  const label = contractLabel(contract);
  if (contract.status === 'signed') throw new Error(`この${label}は締結済みです`);
  if (contract.status === 'void') throw new Error(`この${label}は無効になっています。担当者にお問い合わせください`);
  const supabase = createServiceRoleClient();
  const signedAt = new Date().toISOString();

  // 同意書の「住所・名称・代表者」は、お客様が入れた値で本文を書き換えてから PDF にする
  const isConsent = (contract.kind ?? 'consent') === 'consent';
  const needsParty = isConsent && !!readConsentParty(contract.body_html);
  let bodyHtml = contract.body_html;
  if (needsParty) {
    const p = input.party;
    if (!p || !p.address.trim() || !p.company_name.trim() || !p.representative_name.trim()) {
      throw new Error('住所・名称・代表者を入力してください');
    }
    bodyHtml = fillConsentParty(contract.body_html, p);
  }

  const signed: Contract = {
    ...contract,
    body_html: bodyHtml,
    status: 'signed',
    signer_name: input.signerName,
    signer_title: input.signerTitle,
    signer_email: input.signerEmail,
    signature_method: input.method,
    signature_image: input.method === 'drawn' ? input.signatureImage : null,
    signed_at: signedAt,
    signer_ip: input.ip,
    signer_user_agent: input.userAgent,
  };

  const pdf = await renderPdf(contractPdfHtml(signed, { agentName: partyBName(contract) }));
  const hash = sha256(pdf);
  const path = `contracts/${contract.application_id}/${contract.id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`PDF の保存に失敗しました: ${upErr.message}`);

  const ts = await timestamp.stamp(hash);

  const { data, error } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      body_html: bodyHtml,
      signer_name: signed.signer_name,
      signer_title: signed.signer_title,
      signer_email: signed.signer_email,
      signature_method: signed.signature_method,
      signature_image: signed.signature_image,
      signed_at: signedAt,
      signer_ip: signed.signer_ip,
      signer_user_agent: signed.signer_user_agent,
      signed_pdf_path: path,
      signed_pdf_sha256: hash,
      timestamp_token: ts?.token ?? null,
      timestamp_authority: ts?.authority ?? null,
      timestamped_at: ts?.at ?? null,
    })
    .eq('id', contract.id)
    .neq('status', 'signed')
    .select()
    .single();
  if (error || !data) throw new Error(`締結の記録に失敗しました: ${error?.message ?? ''}`);

  await addHistory(contract.application_id, (contract.kind ?? 'consent') === 'consent' ? 'contract' : 'vendor_contract', contract.status, 'signed', { type: 'customer', name: input.signerName });
  // お客様が入れた住所・名称・代表者で、案件の空欄を埋める（社内で入れた値は上書きしない）
  if (needsParty && input.party) await fillCaseFromParty(contract.application_id, input.party, input.signerName);
  // 自社との同意書のときだけ「同意書の締結」の節目にする（ベンダーとの契約書では段階を動かさない）
  if ((contract.kind ?? 'consent') === 'consent') {
    await reachMilestone(contract.application_id, 'contract_signed', { type: 'customer', name: input.signerName }, signedAt);
  }
  return data as Contract;
}

async function fillCaseFromParty(applicationId: string, p: ConsentParty, signerName: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('applications').select('company_name, address, representative_name').eq('id', applicationId).maybeSingle();
  if (!data) return;
  const update: Record<string, string> = {};
  const labels: Record<string, string> = { company_name: '会社名', address: '所在地', representative_name: '代表者' };
  for (const k of ['company_name', 'address', 'representative_name'] as const) {
    const now = (data[k] as string | null) ?? '';
    if (!now.trim() && p[k].trim()) update[k] = p[k].trim();
  }
  if (Object.keys(update).length === 0) return;
  await supabase.from('applications').update(update).eq('id', applicationId);
  for (const [k, v] of Object.entries(update)) {
    await addHistory(applicationId, labels[k], null, v, { type: 'customer', name: `${signerName}（同意書）` });
  }
}

/** 締結済み PDF の期限付き URL（10 分） */
export async function signedPdfUrl(contract: Contract): Promise<string | null> {
  if (!contract.signed_pdf_path) return null;
  const supabase = createServiceRoleClient();
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(contract.signed_pdf_path, 600, { download: `${contract.title}.pdf` });
  return data?.signedUrl ?? null;
}

export function contractUrl(token: string): string {
  const appUrl = appBaseUrl('http://localhost:3000');
  return `${appUrl}/contract/${token}`;
}
