import type { BillingTiming, Milestone } from './constants';

export type FeeTool = {
  fee_method: 'rate' | 'fixed';
  fee_rate: number | string | null;
  fee_fixed: number | string | null;
};

/** ツールの計算方法でフィーを出す。率は補助金額×率（円未満切り捨て）、定額はその金額 */
export function computeFee(tool: FeeTool | null | undefined, subsidyAmount: number | null | undefined): number | null {
  if (!tool) return null;
  if (tool.fee_method === 'fixed') {
    return tool.fee_fixed == null ? null : Math.floor(Number(tool.fee_fixed));
  }
  if (tool.fee_rate == null || subsidyAmount == null) return null;
  const rate = Number(tool.fee_rate);
  if (!Number.isFinite(rate)) return null;
  // 浮動小数の誤差（例: 1000000 * 0.15 = 150000.00000000003）を避けるため、率を 1 万倍して整数で計算
  const rateInt = Math.round(rate * 10000);
  return Math.floor((subsidyAmount * rateInt) / 10000);
}

export type MilestoneDates = Partial<Record<Milestone, string | null>>;

/**
 * 見込み額と確定額。採択（または交付決定）に達したら見込み額、交付決定に達したら確定額。
 * 補助金額やツールが変わったら呼び直せば計算し直される。
 */
export function computeFees(
  tool: FeeTool | null | undefined,
  subsidyAmount: number | null | undefined,
  dates: MilestoneDates,
): { fee_estimated: number | null; fee_confirmed: number | null } {
  const fee = computeFee(tool, subsidyAmount);
  const adopted = !!dates.adopted || !!dates.grant_decided || !!dates.subsidy_paid;
  const decided = !!dates.grant_decided || !!dates.subsidy_paid;
  return {
    fee_estimated: adopted ? fee : null,
    fee_confirmed: decided ? fee : null,
  };
}

/** 請求タイミングに達しているか */
export function isBillingDue(timing: BillingTiming | null | undefined, dates: MilestoneDates): boolean {
  if (!timing) return false;
  return !!dates[timing];
}

/** 請求額: 確定額 → 見込み額 → 定額 の順で使う */
export function billingAmount(
  fees: { fee_estimated: number | null; fee_confirmed: number | null },
  tool: FeeTool | null | undefined,
): number | null {
  if (fees.fee_confirmed != null) return fees.fee_confirmed;
  if (fees.fee_estimated != null) return fees.fee_estimated;
  if (tool?.fee_method === 'fixed' && tool.fee_fixed != null) return Math.floor(Number(tool.fee_fixed));
  return null;
}
