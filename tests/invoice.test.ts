import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVOICE_SETTINGS,
  calcInvoiceAmounts,
  dueDate,
  invoiceNo,
  invoicePdfHtml,
  isValidRegistrationNo,
  missingSettings,
} from '@/lib/billing/invoice';

describe('請求書', () => {
  it('税別: 消費税を上乗せ（1円未満切り捨て）', () => {
    expect(calcInvoiceAmounts([100000], 'exclusive', 0.1)).toEqual({ subtotal: 100000, tax: 10000, total: 110000 });
    expect(calcInvoiceAmounts([333333], 'exclusive', 0.1)).toEqual({ subtotal: 333333, tax: 33333, total: 366666 });
    expect(calcInvoiceAmounts([50000, 50001], 'exclusive', 0.1)).toEqual({ subtotal: 100001, tax: 10000, total: 110001 });
  });
  it('税込: 含まれる消費税を出す', () => {
    expect(calcInvoiceAmounts([110000], 'inclusive', 0.1)).toEqual({ subtotal: 100000, tax: 10000, total: 110000 });
    expect(calcInvoiceAmounts([100000], 'inclusive', 0.1)).toEqual({ subtotal: 90910, tax: 9090, total: 100000 });
  });
  it('支払期限', () => {
    expect(dueDate('2026-11-12', 30, false)).toBe('2026-12-12');
    expect(dueDate('2026-11-12', 30, true)).toBe('2026-12-31');
    expect(dueDate('2026-01-31', 30, true)).toBe('2026-03-31');
    expect(dueDate('2026-12-20', 30, true)).toBe('2027-01-31');
  });
  it('請求書番号', () => {
    expect(invoiceNo('INV', '2026-11-12', 1)).toBe('INV-202611-001');
    expect(invoiceNo('', '2026-11-12', 12)).toBe('202611-012');
  });
  it('登録番号と、足りない設定', () => {
    expect(isValidRegistrationNo('T1234567890123')).toBe(true);
    expect(isValidRegistrationNo('T 1234-5678-90123')).toBe(true);
    expect(isValidRegistrationNo('1234567890123')).toBe(false);
    expect(missingSettings(DEFAULT_INVOICE_SETTINGS)).toEqual(['請求元の会社名', '請求元の住所', 'インボイスの登録番号', '振込先']);
  });
  it('HTML に必要な項目が入り、文字はエスケープされる', () => {
    const html = invoicePdfHtml({
      invoice_no: 'INV-202611-001',
      issued_on: '2026-11-12',
      due_on: '2026-12-31',
      transaction_on: '2026-11-01',
      bill_to_name: 'MEM株式会社 御中',
      bill_to_address: null,
      items: [{ label: '申請支援 <報酬>', amount: 100000 }],
      subtotal: 100000,
      tax: 10000,
      total: 110000,
      tax_rate: 0.1,
      tax_mode: 'exclusive',
      issuer: { ...DEFAULT_INVOICE_SETTINGS, issuer_name: '株式会社AzCreate', registration_no: 'T1234567890123', bank_info: '○○銀行\n普通 1234567' },
      note: null,
    });
    expect(html).toContain('INV-202611-001');
    expect(html).toContain('登録番号: T1234567890123');
    expect(html).toContain('¥110,000');
    expect(html).toContain('10%対象（税抜）');
    expect(html).toContain('取引年月日: 2026年11月1日');
    expect(html).toContain('申請支援 &lt;報酬&gt;');
    expect(html).toContain('○○銀行<br>普通 1234567');
  });
});
