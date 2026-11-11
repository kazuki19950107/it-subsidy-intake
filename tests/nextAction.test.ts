import { describe, expect, it } from 'vitest';
import { nextAction, type NextActionInput } from '@/lib/cases/nextAction';

const fresh: NextActionInput = {
  infoFilled: false,
  consent: 'none',
  lineLinked: false,
  formSubmitted: false,
  staffReviewCount: 0,
  portalLinked: false,
  rejected: false,
  adopted: false,
  vendorSet: false,
  vendorContract: 'none',
  vendorInvoice: false,
  grantDecided: false,
  billing: null,
};

describe('次にやること', () => {
  it('登録したてなら、会社情報から', () => {
    const na = nextAction(fresh);
    expect(na.phase).toBe(1);
    expect(na.next?.key).toBe('info');
  });

  it('同意書を送ったら署名待ち（お客様）、署名後はグループLINE', () => {
    const sent = nextAction({ ...fresh, infoFilled: true, consent: 'viewed' });
    expect(sent.next?.key).toBe('consent_sign');
    expect(sent.next?.who).toBe('customer');
    expect(nextAction({ ...fresh, infoFilled: true, consent: 'signed' }).next?.key).toBe('line');
  });

  it('書類が出て確認が必要なら、確認を出す', () => {
    const na = nextAction({ ...fresh, infoFilled: true, consent: 'signed', lineLinked: true, formSubmitted: true, staffReviewCount: 2 });
    expect(na.phase).toBe(2);
    expect(na.next?.key).toBe('review');
    expect(na.next?.action).toContain('2件');
  });

  it('採択後はベンダーの契約書から。前のフェーズの未完了は「やり残し」に分ける', () => {
    const na = nextAction({ ...fresh, infoFilled: true, formSubmitted: true, portalLinked: true, adopted: true, vendorSet: true });
    expect(na.phase).toBe(4);
    expect(na.next?.key).toBe('vendor_contract');
    expect(na.leftovers.map((s) => s.key)).toEqual(['consent_send', 'line']);
  });

  it('請求書を出したら入金、入金で完了', () => {
    const base = {
      ...fresh,
      infoFilled: true,
      consent: 'signed' as const,
      lineLinked: true,
      formSubmitted: true,
      portalLinked: true,
      adopted: true,
      vendorSet: true,
      vendorContract: 'signed' as const,
      vendorInvoice: true,
      grantDecided: true,
    };
    expect(nextAction({ ...base, billing: null }).next?.key).toBe('billing_ready');
    expect(nextAction({ ...base, billing: { issued: false, paid: false } }).next?.key).toBe('fee_invoice');
    expect(nextAction({ ...base, billing: { issued: true, paid: false } }).next?.key).toBe('paid');
    const done = nextAction({ ...base, billing: { issued: true, paid: true } });
    expect(done.next).toBeNull();
    expect(done.finished).toBe('done');
  });

  it('不採択なら終わり', () => {
    expect(nextAction({ ...fresh, portalLinked: true, rejected: true }).finished).toBe('rejected');
  });
});
