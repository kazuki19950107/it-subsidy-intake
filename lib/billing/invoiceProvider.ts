import 'server-only';
import type { Application, BillingSchedule } from '@/lib/supabase/types';

// 請求書の発行サービスとの連携口。使うサービスが決まったら InvoiceProvider を実装して
// getInvoiceProvider() で返すようにする（例: freee / Misoca / マネーフォワード）。
// 今は「手入力」: 管理画面で請求書発行日を入れると発行済みになる。

export type IssuedInvoice = { externalId: string | null; url: string | null };

export interface InvoiceProvider {
  readonly name: string;
  /** 外部サービスで請求書を作る。手入力のときは何もしない */
  issue(schedule: BillingSchedule, app: Application): Promise<IssuedInvoice>;
}

export const manualInvoiceProvider: InvoiceProvider = {
  name: '手入力',
  async issue() {
    return { externalId: null, url: null };
  },
};

export function getInvoiceProvider(): InvoiceProvider {
  return manualInvoiceProvider;
}
