import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { closestOption, parseLenient, toNumber } from '@/lib/claude/extractors/repair';
import { TaxCert1Schema } from '@/lib/claude/extractors/taxCertificate1';
import { FinancialStatementsSchema } from '@/lib/claude/extractors/financialStatements';

describe('AIの答えを直して受け取る', () => {
  it('選択肢の言い換えを近いものに合わせる', () => {
    const opts = ['その1', 'その2', 'その3', 'その4', 'unknown'];
    expect(closestOption('その3の3', opts)).toBe('その3');
    expect(closestOption('その３の２', opts)).toBe('その3');
    expect(closestOption('納税証明書（その1）', opts)).toBe('その1');
    expect(closestOption('わからない', opts)).toBe('unknown');
    expect(closestOption(null, opts)).toBe('unknown');
    expect(closestOption('x', ['a', 'b'])).toBeNull();
  });

  it('金額の文字を数にする', () => {
    expect(toNumber('1,234円')).toBe(1234);
    expect(toNumber('１２３')).toBe(123);
    expect(toNumber('不明')).toBeNull();
  });

  it('納税証明書の「その3の3」で解析失敗にならない', () => {
    const { data, repaired } = parseLenient(TaxCert1Schema, {
      certificate_type: 'その3の3',
      tax_category: '法人税等',
      taxpayer_address: '東京都',
      taxpayer_name: 'サンプル株式会社',
      representative: null,
      fiscal_year_from: null,
      fiscal_year_to: null,
      tax_due: '1,000円',
      tax_paid: 1000,
      tax_unpaid: null,
      issuer: '麹町税務署長',
      issued_date: '2026-11-01',
      // certificate_no が抜けている
    });
    expect(data.certificate_type).toBe('その3');
    expect(data.tax_category).toBe('法人税');
    expect(data.tax_due).toBe(1000);
    expect(data.certificate_no).toBeNull();
    expect(repaired.length).toBeGreaterThan(0);
  });

  it('配列の中の合わない選択肢は「不明」にする', () => {
    const { data } = parseLenient(FinancialStatementsSchema, {
      document_types_detected: ['PL', '株主資本等変動計算書', 'BS'],
      company_name: 'A社',
      fiscal_period_from: null,
      fiscal_period_to: null,
      net_sales: '12,000,000',
      gross_profit: null,
      operating_profit: null,
      total_assets: null,
      total_liabilities: null,
      net_assets: null,
    });
    expect(data.document_types_detected).toEqual(['PL', 'unknown', 'BS']);
    expect(data.net_sales).toBe(12000000);
  });

  it('直しようがないものはそのままエラー', () => {
    expect(() => parseLenient(z.object({ a: z.string().min(3) }), { a: 'x' })).toThrow();
  });
});
