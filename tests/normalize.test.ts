import { describe, expect, it } from 'vitest';
import { namesLikelyMatch, normalizeCorporateNumber, normalizeName } from '@/lib/portal/match';
import { corporateNumberMatches, checkRegisteredCompany } from '@/lib/validation/crossCheck';

describe('normalizeName', () => {
  it('全角半角・法人格・空白・末尾の様をそろえる', () => {
    expect(normalizeName('ＭＥＭ 株式会社 様')).toBe('mem');
    expect(normalizeName('株式会社MEM')).toBe('mem');
    expect(normalizeName('（株）ＭＥＭ')).toBe('mem');
    expect(normalizeName('㈱MEM御中')).toBe('mem');
  });
  it('途中の「様」は消さない', () => {
    expect(normalizeName('様似運輸株式会社')).toBe('様似運輸');
  });
  it('null', () => {
    expect(normalizeName(null)).toBe('');
  });
});

describe('namesLikelyMatch', () => {
  it('包含関係で候補にする', () => {
    expect(namesLikelyMatch('株式会社サンプル商事', 'サンプル商事東京支店')).toBe(true);
    expect(namesLikelyMatch('AB', 'AB')).toBe(false);
  });
});

describe('normalizeCorporateNumber', () => {
  it('13 桁にそろえる', () => {
    expect(normalizeCorporateNumber('1234-5678-90123')).toBe('1234567890123');
    expect(normalizeCorporateNumber('１２３４５６７８９０１２３')).toBe('1234567890123');
    expect(normalizeCorporateNumber('123')).toBeNull();
  });
});

describe('corporateNumberMatches', () => {
  it('13 桁同士・12 桁（会社法人等番号）で比べる', () => {
    expect(corporateNumberMatches('1234567890123', '1234567890123')).toBe(true);
    expect(corporateNumberMatches('1234567890123', '2345-67-890123')).toBe(true);
    expect(corporateNumberMatches('1234567890123', '999999999999')).toBe(false);
    expect(corporateNumberMatches(null, '1234567890123')).toBeNull();
  });
});

describe('checkRegisteredCompany', () => {
  it('会社名と法人番号の不一致を不備にする', () => {
    const r = checkRegisteredCompany(
      {
        certificateOfHistory: { company_name: '株式会社ちがう', company_number: '999999999999' },
        taxCert1: { taxpayer_name: 'MEM株式会社' },
      },
      { company_name: '株式会社MEM', corporate_number: '1234567890123' },
    );
    expect(r.map((x) => x.field)).toEqual(['registered.company_name', 'registered.corporate_number']);
    expect(r.every((x) => x.level === 'error')).toBe(true);
  });
  it('登録が無ければ何もしない', () => {
    expect(checkRegisteredCompany({ certificateOfHistory: { company_name: 'X' } }, null)).toEqual([]);
  });
});

import { roundFromPortal } from '@/lib/portal/match';
describe('roundFromPortal', () => {
  it('募集回を数字に', () => {
    expect(roundFromPortal('8次')).toBe(8);
    expect(roundFromPortal('１２次')).toBe(12);
    expect(roundFromPortal('募集回未決定')).toBeNull();
    expect(roundFromPortal(null)).toBeNull();
  });
});
