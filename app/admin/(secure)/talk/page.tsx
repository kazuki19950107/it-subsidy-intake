import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getQuota, lineConfigured } from '@/lib/line/client';
import { listThreads } from '@/lib/line/threads';
import { TalkClient } from './TalkClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'トーク' };

export default async function TalkPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  const supabase = createServiceRoleClient();
  const [threads, { data: accounts }] = await Promise.all([
    listThreads(),
    supabase.from('accounts').select('name').eq('active', true).order('sort_order'),
  ]);
  let quota: { limit: number | null; used: number } | null = null;
  if (lineConfigured()) quota = await getQuota().catch(() => null);

  return (
    <TalkClient
      initialThreads={threads}
      initialGroupId={g ?? null}
      staffNames={((accounts ?? []) as Array<{ name: string }>).map((a) => a.name)}
      quota={quota}
    />
  );
}
