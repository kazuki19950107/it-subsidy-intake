import { createServiceRoleClient } from '@/lib/supabase/server';

// Claude Sonnet 4.5 の概算単価 (USD / 1M tokens)
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * INPUT_COST_PER_MTOK) / 1_000_000 +
    (outputTokens * OUTPUT_COST_PER_MTOK) / 1_000_000
  );
}

export async function logApiUsage(params: {
  applicationId?: string | null;
  documentId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<number> {
  const cost = estimateCost(params.inputTokens, params.outputTokens);
  const supabase = createServiceRoleClient();
  await supabase.from('api_usage_logs').insert({
    application_id: params.applicationId ?? null,
    document_id: params.documentId ?? null,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: cost,
  });
  return cost;
}

export async function checkMonthlyBudget(): Promise<{ over: boolean; used: number; budget: number }> {
  const budget = parseFloat(process.env.MONTHLY_API_BUDGET_USD ?? '100');
  const supabase = createServiceRoleClient();
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('api_usage_logs')
    .select('estimated_cost_usd')
    .gte('created_at', firstOfMonth.toISOString());

  const used = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  return { over: used >= budget, used, budget };
}

export async function checkApplicationBudget(applicationId: string): Promise<{ over: boolean; used: number; budget: number }> {
  const budget = parseFloat(process.env.PER_APPLICATION_BUDGET_USD ?? '1.0');
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('api_usage_logs')
    .select('estimated_cost_usd')
    .eq('application_id', applicationId);

  const used = (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
  return { over: used >= budget, used, budget };
}
