import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, Contract, Tool } from '@/lib/supabase/types';
import { sha256 } from '@/lib/utils/hash';
import { BILLING_TIMING_LABELS } from '@/lib/cases/constants';
import { addHistory, reachMilestone } from '@/lib/cases/service';
import { CONTRACT_TEMPLATE, CONTRACT_TITLE, TEMPLATE_VERSION, renderContractHtml, type ContractVars } from './template';
import { contractPdfHtml, renderPdf } from './pdf';
import { noTimestamp, type TimestampProvider } from './timestamp';

export const AGENT_NAME = process.env.AGENT_COMPANY_NAME || 'Assemble';

function feeDescription(tool: Tool | null): string {
  if (!tool) return '別途定める報酬';
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
  return {
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

  const { data: existing } = await supabase.from('contracts').select('id, status').eq('application_id', applicationId);
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
      body_html: renderContractHtml(CONTRACT_TEMPLATE, vars),
      template_version: TEMPLATE_VERSION,
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
  if (contract.status === 'signed') throw new Error('この同意書は締結済みです');
  if (contract.status === 'void') throw new Error('この同意書は無効になっています。担当者にお問い合わせください');
  const supabase = createServiceRoleClient();
  const signedAt = new Date().toISOString();

  const signed: Contract = {
    ...contract,
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

  const pdf = await renderPdf(contractPdfHtml(signed, { agentName: AGENT_NAME }));
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

  await addHistory(contract.application_id, 'contract', contract.status, 'signed', { type: 'customer', name: input.signerName });
  await reachMilestone(contract.application_id, 'contract_signed', { type: 'customer', name: input.signerName }, signedAt);
  return data as Contract;
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${appUrl}/contract/${token}`;
}
