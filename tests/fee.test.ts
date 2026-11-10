import { describe, expect, it } from 'vitest';
import { billingAmount, computeFee, computeFees, isBillingDue } from '@/lib/cases/fee';

const BU = { fee_method: 'rate' as const, fee_rate: '0.1500', fee_fixed: null };
const LU = { fee_method: 'rate' as const, fee_rate: 0.1, fee_fixed: null };
const FIXED = { fee_method: 'fixed' as const, fee_rate: null, fee_fixed: 300000 };

describe('computeFee', () => {
  it('補助金額×率（円未満切り捨て・誤差なし）', () => {
    expect(computeFee(BU, 1_000_000)).toBe(150_000);
    expect(computeFee(LU, 1_234_567)).toBe(123_456);
    expect(computeFee(BU, 333)).toBe(49);
  });
  it('定額', () => {
    expect(computeFee(FIXED, null)).toBe(300_000);
    expect(computeFee(FIXED, 5_000_000)).toBe(300_000);
  });
  it('補助金額やツールが無ければ null', () => {
    expect(computeFee(BU, null)).toBeNull();
    expect(computeFee(null, 100)).toBeNull();
  });
});

describe('computeFees', () => {
  it('採択前はどちらも空', () => {
    expect(computeFees(BU, 1_000_000, {})).toEqual({ fee_estimated: null, fee_confirmed: null });
  });
  it('採択で見込み額', () => {
    expect(computeFees(BU, 1_000_000, { adopted: '2026-01-01' })).toEqual({ fee_estimated: 150_000, fee_confirmed: null });
  });
  it('交付決定で確定額（補助金額が変われば計算し直し）', () => {
    const d = { adopted: '2026-01-01', grant_decided: '2026-02-01' };
    expect(computeFees(BU, 1_000_000, d)).toEqual({ fee_estimated: 150_000, fee_confirmed: 150_000 });
    expect(computeFees(BU, 800_000, d)).toEqual({ fee_estimated: 120_000, fee_confirmed: 120_000 });
  });
});

describe('isBillingDue / billingAmount', () => {
  it('請求タイミングの節目に達したか', () => {
    expect(isBillingDue('subsidy_paid', { grant_decided: 'x' })).toBe(false);
    expect(isBillingDue('subsidy_paid', { subsidy_paid: 'x' })).toBe(true);
    expect(isBillingDue('contract_signed', { contract_signed: 'x' })).toBe(true);
  });
  it('確定額 → 見込み額 → 定額', () => {
    expect(billingAmount({ fee_estimated: 1, fee_confirmed: 2 }, BU)).toBe(2);
    expect(billingAmount({ fee_estimated: 1, fee_confirmed: null }, BU)).toBe(1);
    expect(billingAmount({ fee_estimated: null, fee_confirmed: null }, FIXED)).toBe(300_000);
    expect(billingAmount({ fee_estimated: null, fee_confirmed: null }, BU)).toBeNull();
  });
});
