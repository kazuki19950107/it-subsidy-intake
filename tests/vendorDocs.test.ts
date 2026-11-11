import { describe, expect, it } from 'vitest';
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/billing/invoice';
import { renderContractText } from '@/lib/contracts/template';
import {
  VENDOR_CONTRACT_TEMPLATE,
  itemsFromPortal,
  unknownVars,
  vendorContractVars,
} from '@/lib/vendorDocs/template';
import type { PortalDetail } from '@/lib/portal/detail';

const detail: PortalDetail = {
  round: 3,
  corporate_number: null,
  representative_name: null,
  tools: [
    { tool_no: 'DL07-0021999', name: 'BizFlo', category: 'ソフトウェア', subtotal: 2_000_000 },
    { tool_no: null, name: 'PCセキュリティみまもりパック', category: 'セキュリティ', subtotal: 300_000 },
    { tool_no: null, name: '金額なし', category: null, subtotal: null },
  ],
  subsidy_requested: 1_500_000,
  eligible_cost: 2_300_000,
  total_cost: 2_530_000,
  fetched_at: '2026-11-12T00:00:00Z',
};

describe('ベンダーからお客様への書類', () => {
  it('ポータルの IT ツールを請求書の品目にする（金額の無いものは除く）', () => {
    expect(itemsFromPortal(detail)).toEqual([
      { label: 'BizFlo（DL07-0021999）', amount: 2_000_000 },
      { label: 'PCセキュリティみまもりパック', amount: 300_000 },
    ]);
    expect(itemsFromPortal(null)).toEqual([]);
  });

  it('契約書の差し込み（税抜・消費税・税込・自己負担）', () => {
    const vars = vendorContractVars({
      client: { company_name: 'MEM株式会社', address: '東京都', representative_name: '尾崎 太郎', round: 3, portal_application_no: '1234567' },
      vendor: { ...DEFAULT_INVOICE_SETTINGS, issuer_name: '株式会社ベンダー', issuer_address: '大阪府', representative_name: '山田 花子' },
      items: itemsFromPortal(detail),
      subsidyAmount: 1_500_000,
      issuedOn: '2026/11/12',
    });
    expect(vars.subtotal).toBe('2,300,000円');
    expect(vars.tax).toBe('230,000円');
    expect(vars.total).toBe('2,530,000円');
    expect(vars.self_pay).toBe('1,030,000円');
    expect(vars.tool_lines).toBe('・BizFlo（DL07-0021999）　2,000,000円（税抜）\n・PCセキュリティみまもりパック　300,000円（税抜）');
    const text = renderContractText(VENDOR_CONTRACT_TEMPLATE, vars as never);
    expect(text).toContain('MEM株式会社（以下「甲」という）と株式会社ベンダー（以下「乙」という）');
    expect(text).toContain('交付申請番号 1234567');
    expect(text).not.toContain('{{');
  });

  it('仮の文面に知らない差し込みが無い・打ち間違いを見つける', () => {
    expect(unknownVars(VENDOR_CONTRACT_TEMPLATE)).toEqual([]);
    expect(unknownVars('{{client_company}} と {{vender_name}}')).toEqual(['vender_name']);
  });
});
