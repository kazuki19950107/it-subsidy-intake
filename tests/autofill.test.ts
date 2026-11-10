import { describe, expect, it } from 'vitest';
import { corporateNumberFromCompanyNumber, fillEmpty, identityFromDocuments } from '@/lib/cases/autofill';

describe('corporateNumberFromCompanyNumber', () => {
  it('会社法人等番号（12桁）から検査用数字を付けて法人番号にする', () => {
    // 国税庁の法人番号 7000012050002（会社法人等番号 0000-12-050002）
    expect(corporateNumberFromCompanyNumber('0000-12-050002')).toBe('7000012050002');
    expect(corporateNumberFromCompanyNumber('００００１２０５０００２')).toBe('7000012050002');
  });
  it('13桁ならそのまま、桁数が違えば null', () => {
    expect(corporateNumberFromCompanyNumber('1234567890123')).toBe('1234567890123');
    expect(corporateNumberFromCompanyNumber('12345')).toBeNull();
    expect(corporateNumberFromCompanyNumber(null)).toBeNull();
  });
});

describe('identityFromDocuments', () => {
  it('法人は登記簿を優先し、無ければ納税証明書・決算書から', () => {
    expect(
      identityFromDocuments('corporation', {
        certificateOfHistory: {
          company_name: '株式会社テスト',
          company_number: '000012050002',
          representative_name: '山田 太郎',
          head_office_address: '東京都千代田区1-1',
        },
        taxCert1: { taxpayer_name: '別の名前' },
      }),
    ).toEqual({
      company_name: '株式会社テスト',
      corporate_number: '7000012050002',
      representative_name: '山田 太郎',
      address: '東京都千代田区1-1',
    });
    expect(identityFromDocuments('corporation', { taxCert1: { taxpayer_name: 'A社', representative: '佐藤', taxpayer_address: '大阪' } })).toEqual({
      company_name: 'A社',
      corporate_number: null,
      representative_name: '佐藤',
      address: '大阪',
    });
  });
  it('個人事業主は本人確認書類・確定申告書から氏名と住所', () => {
    expect(
      identityFromDocuments('sole_proprietor', {
        idDocument: { full_name: '鈴木 花子', address: '' },
        taxReturn: { filer_name: 'x', filer_address: '福岡県福岡市' },
      }),
    ).toEqual({ company_name: null, corporate_number: null, representative_name: '鈴木 花子', address: '福岡県福岡市' });
  });
});

describe('fillEmpty', () => {
  it('空欄だけを埋め、入力済みは上書きしない', () => {
    expect(
      fillEmpty(
        { company_name: '社内で入れた名前', corporate_number: null, representative_name: '', address: undefined },
        { company_name: '書類の名前', corporate_number: '7000012050002', representative_name: '山田', address: null },
      ),
    ).toEqual({ corporate_number: '7000012050002', representative_name: '山田' });
  });
});
