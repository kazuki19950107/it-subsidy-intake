import { describe, expect, it } from 'vitest';
import { parseCsv, parseImportCsv } from '@/lib/cases/csvImport';
import { missingContractVars, renderContractHtml, renderContractText } from '@/lib/contracts/template';
import { validateTaxCert1 } from '@/lib/claude/extractors/taxCertificate1';
import { validateFinancialStatements } from '@/lib/claude/extractors/financialStatements';
import { mergeDocRules, requiredDocsFor } from '@/lib/docRules/defaults';

describe('parseCsv', () => {
  it('クォート・改行・BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x,1","y ""z"""\n\n')).toEqual([
      ['a', 'b'],
      ['x,1', 'y "z"'],
    ]);
  });
});

describe('parseImportCsv', () => {
  it('見出しから列を対応づけ、値を整える', () => {
    const r = parseImportCsv('会社名,法人番号,回次,補助金額,ツール,区分,謎\nMEM株式会社,1234-5678-90123,３次,"1,500,000",bu,,x\n,,,,,,\n');
    expect(r.errors).toEqual([]);
    expect(r.unknownHeaders).toEqual(['謎']);
    expect(r.rows[0]).toMatchObject({
      line: 2,
      company_name: 'MEM株式会社',
      corporate_number: '1234567890123',
      round: 3,
      subsidy_amount: 1500000,
      tool_code: 'BU',
      applicant_type: 'corporation',
    });
  });
  it('誤りを行番号つきで返す', () => {
    const r = parseImportCsv('会社名,法人番号,回次\nA,123,x\n,1,2\n');
    expect(r.errors.map((e) => e.line)).toEqual([2, 2, 3]);
  });
  it('会社名の見出しが無い', () => {
    expect(parseImportCsv('名前\nA').errors[0].message).toContain('会社名');
  });
});

describe('contract template', () => {
  it('差し込みと HTML のエスケープ', () => {
    const t = '{{company_name}}と{{agent_name}}\n\n住所 {{address}}';
    expect(renderContractText(t, { company_name: 'A社', agent_name: 'Assemble' })).toBe('A社とAssemble\n\n住所 （未入力）');
    expect(renderContractHtml('{{company_name}}', { company_name: '<b>' })).toBe('<p>&lt;b&gt;</p>');
    expect(missingContractVars(t, { company_name: 'A社' })).toEqual(['agent_name', 'address']);
  });
});

describe('書類の判定設定', () => {
  it('納税証明書は既定で その3 を求め、その3 なら税目は問わない', () => {
    expect(validateTaxCert1({ certificate_type: 'その3', tax_category: 'その他', issuer: '○○税務署長' })).toEqual([]);
    expect(validateTaxCert1({ certificate_type: 'その1', tax_category: '法人税', issuer: '○○税務署長' })[0].message).toContain('その3');
  });
  it('その1 に設定すれば税目も確認する', () => {
    const errs = validateTaxCert1(
      { certificate_type: 'その1', tax_category: '消費税', issuer: '○○税務署長' },
      { certificate_type: 'その1' },
    );
    expect(errs.map((e) => e.field)).toEqual(['tax_category']);
  });
  it('決算書の必要書類を設定で変えられる（キャッシュフロー計算書）', () => {
    const data = { document_types_detected: ['PL', 'SGA', 'BS'] as Array<'PL' | 'SGA' | 'BS'>, fiscal_period_to: new Date().toISOString().slice(0, 10) };
    expect(validateFinancialStatements(data).filter((e) => e.level === 'error')).toEqual([]);
    const withCf = validateFinancialStatements(data, { required_sections: ['PL', 'BS', 'CF'] });
    expect(withCf.map((e) => e.message).join()).toContain('キャッシュフロー計算書');
  });
  it('DB の上書きを重ねる', () => {
    const rules = mergeDocRules([{ doc_type: 'tax_cert_1', required_corporation: false, params: { certificate_type: 'その1' } }]);
    expect(rules.tax_cert_1.params.certificate_type).toBe('その1');
    expect(requiredDocsFor('corporation', rules)).toEqual(['certificate_of_history', 'financial_statements']);
    expect(requiredDocsFor('sole_proprietor')).toEqual(['id_document', 'tax_return', 'blue_form', 'tax_cert_2']);
  });
});

import { billingTriggerLabel } from '@/lib/cases/constants';
describe('請求予定のきっかけの表示名', () => {
  it('手で作ったものと、自動のタイミング', () => {
    expect(billingTriggerLabel('manual')).toBe('手動で作成');
    expect(billingTriggerLabel('subsidy_paid')).toBe('補助金の入金後');
  });
});

import { CONTRACT_TEMPLATE, alignConsentHtml, warekiDate } from '@/lib/contracts/template';
describe('同意書（ひな形どおり）', () => {
  it('令和の日付（日本時間）', () => {
    expect(warekiDate(new Date('2026-05-10T16:00:00Z'))).toBe('令和8年5月11日');
  });
  it('宛名・年・会社の情報が入り、日付は右・記は中央・以上は右', () => {
    const html = alignConsentHtml(
      renderContractHtml(CONTRACT_TEMPLATE, {
        issued_on_wareki: '令和8年11月12日',
        addressee: '株式会社AzCreate',
        fiscal_year: '2026',
        company_name: 'サンプル株式会社',
        address: '東京都千代田区',
        representative_name: '山田 太郎',
      }),
    );
    expect(html.startsWith('<p style="text-align:right">令和8年11月12日</p>')).toBe(true);
    expect(html).toContain('<p>株式会社AzCreate　御中</p>');
    expect(html).toContain('私は2026年のIT導入補助金の申請に関して');
    expect(html).toContain('<p style="text-align:center">記</p>');
    expect(html).toContain('<p style="text-align:right">以上</p>');
    expect(html).toContain('名　称　サンプル株式会社');
    expect(html).not.toContain('（未入力）');
  });
});

import { fillConsentParty, readConsentParty } from '@/lib/contracts/template';
describe('同意書の住所・名称・代表者をお客様が入れる', () => {
  const html = alignConsentHtml(
    renderContractHtml(CONTRACT_TEMPLATE, { issued_on_wareki: '令和8年11月12日', addressee: 'ベンダー', fiscal_year: '2026', company_name: '株式会社ライフ' }),
  );
  it('未入力は空として読む', () => {
    expect(readConsentParty(html)).toEqual({ address: '', company_name: '株式会社ライフ', representative_name: '' });
    expect(readConsentParty('<p>ほかの書類</p>')).toBeNull();
  });
  it('入れた値で置き換える（文字はエスケープ）', () => {
    const out = fillConsentParty(html, { address: '東京都<港区>', company_name: '株式会社ライフ', representative_name: '山田 太郎' });
    expect(out).toContain('住　所　東京都&lt;港区&gt;<br>名　称　株式会社ライフ<br>代表者　山田 太郎');
    expect(readConsentParty(out)).toEqual({ address: '東京都<港区>', company_name: '株式会社ライフ', representative_name: '山田 太郎' });
  });
});
