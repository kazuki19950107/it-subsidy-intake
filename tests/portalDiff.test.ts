import { describe, expect, it } from 'vitest';
import { corporateNumberFromRaw, diffPortalRows, matchPortalRow } from '@/lib/portal/diff';
import { isForward, stageForMilestone, stageForPortalStatus } from '@/lib/cases/stageRules';

describe('diffPortalRows', () => {
  const prev = new Map<string, string | null>([
    ['KSN-1', '審査中'],
    ['KSN-2', '採択'],
    ['KSN-3', null],
  ]);
  it('変わったもの・新しいものだけを返す', () => {
    const changes = diffPortalRows(prev, [
      { application_no: 'KSN-1', applicant_name: 'A', status: '採択' },
      { application_no: 'KSN-2', applicant_name: 'B', status: '採択' },
      { application_no: 'KSN-3', applicant_name: 'C', status: null },
      { application_no: 'KSN-4', applicant_name: 'D', status: '申請済' },
    ]);
    expect(changes).toEqual([
      { application_no: 'KSN-1', applicant_name: 'A', from: '審査中', to: '採択', isNew: false },
      { application_no: 'KSN-4', applicant_name: 'D', from: null, to: '申請済', isNew: true },
    ]);
  });
  it('今回無くなった案件は変化に含めない・重複行は 1 回', () => {
    const changes = diffPortalRows(prev, [
      { application_no: 'KSN-1', applicant_name: 'A', status: '交付決定' },
      { application_no: 'KSN-1', applicant_name: 'A', status: '交付決定' },
    ]);
    expect(changes).toHaveLength(1);
  });
});

describe('matchPortalRow', () => {
  const cases = [
    { id: 'x', portal_application_no: 'KSN-1', corporate_number: null, company_name: '株式会社エックス' },
    { id: 'y', portal_application_no: null, corporate_number: '1234567890123', company_name: '株式会社ワイ' },
    { id: 'z', portal_application_no: null, corporate_number: null, company_name: '株式会社ゼット' },
    { id: 'z2', portal_application_no: null, corporate_number: null, company_name: 'ゼット株式会社' },
  ];
  it('申請番号が最優先', () => {
    expect(matchPortalRow({ application_no: 'KSN-1', applicant_name: '別名' }, cases)).toEqual({ kind: 'application_no', caseId: 'x' });
  });
  it('次に法人番号', () => {
    expect(
      matchPortalRow({ application_no: 'KSN-9', applicant_name: '?', corporate_number: '1234567890123' }, cases),
    ).toEqual({ kind: 'corporate_number', caseId: 'y' });
  });
  it('会社名は候補だけ', () => {
    expect(matchPortalRow({ application_no: 'KSN-9', applicant_name: 'ゼット 株式会社' }, cases)).toEqual({
      kind: 'name_candidates',
      caseIds: ['z', 'z2'],
    });
  });
  it('一致なし', () => {
    expect(matchPortalRow({ application_no: 'KSN-9', applicant_name: '無関係' }, cases)).toEqual({ kind: 'none' });
  });
});

describe('corporateNumberFromRaw', () => {
  it('セルから 13 桁を探す', () => {
    expect(corporateNumberFromRaw({ cells: ['KSN06-0057481', '1234-5678-90123'] })).toBe('1234567890123');
    expect(corporateNumberFromRaw({ cells: ['KSN06-0057481'] })).toBeNull();
    expect(corporateNumberFromRaw(null)).toBeNull();
  });
});

describe('stage rules', () => {
  const stages = [
    { id: 's1', sort_order: 10, milestone: null, portal_keywords: [] },
    { id: 's4', sort_order: 40, milestone: 'applied' as const, portal_keywords: ['申請済', '審査中'] },
    { id: 's5', sort_order: 50, milestone: 'adopted' as const, portal_keywords: ['採択'] },
    { id: 's8', sort_order: 80, milestone: null, portal_keywords: ['不採択'] },
  ];
  it('最も長く一致した語の段階（不採択 > 採択）', () => {
    expect(stageForPortalStatus(stages, '採択')?.id).toBe('s5');
    expect(stageForPortalStatus(stages, '不採択')?.id).toBe('s8');
    expect(stageForPortalStatus(stages, '交付申請 審査中')?.id).toBe('s4');
    expect(stageForPortalStatus(stages, '入力中')).toBeNull();
  });
  it('節目の段階', () => {
    expect(stageForMilestone(stages, 'adopted')?.id).toBe('s5');
    expect(stageForMilestone(stages, 'subsidy_paid')).toBeNull();
  });
  it('先へだけ動かす', () => {
    expect(isForward(stages[2], stages[1])).toBe(false);
    expect(isForward(stages[1], stages[2])).toBe(true);
    expect(isForward(null, stages[0])).toBe(true);
  });
});
