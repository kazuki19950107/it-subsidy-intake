import { describe, expect, it } from 'vitest';
import { fieldLabel, formatFieldValue, orderedFields } from '@/lib/documents/fieldLabels';

describe('抽出結果の日本語', () => {
  it('項目名', () => {
    expect(fieldLabel('net_sales')).toBe('売上高');
    expect(fieldLabel('head_office_address')).toBe('本店所在地');
    expect(fieldLabel('unknown_key')).toBe('unknown_key');
  });
  it('値の見せ方', () => {
    expect(formatFieldValue('net_sales', 71072728)).toBe('71,072,728円');
    expect(formatFieldValue('tax_unpaid', 0)).toBe('0円');
    expect(formatFieldValue('document_types_detected', ['PL', 'SGA', 'BS'])).toBe('損益計算書・販管費の内訳・貸借対照表');
    expect(formatFieldValue('filing_type', 'blue')).toBe('青色申告');
    expect(formatFieldValue('issuer', null)).toBeNull();
    expect(formatFieldValue('company_name', '株式会社EN')).toBe('株式会社EN');
  });
  it('並び順（会社名が先、_ で始まる項目は出さない）', () => {
    const keys = orderedFields({ net_sales: 1, _confidence: 0.9, company_name: 'A', zzz: 1 }).map(([k]) => k);
    expect(keys).toEqual(['company_name', 'net_sales', 'zzz']);
  });
});
