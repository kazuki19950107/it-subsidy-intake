import { NextRequest, NextResponse } from 'next/server';
import { listSyncableVendors, syncVendorPortal } from '@/lib/portal/sync';

// Vercel Cron から呼ばれる。Authorization: Bearer <CRON_SECRET> を必須にする。
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const vendors = await listSyncableVendors();
  const results: Array<Record<string, unknown>> = [];
  for (const v of vendors) {
    try {
      const r = await syncVendorPortal(v.id, 'cron');
      results.push({ vendor: v.name, ok: true, rows: r.rows, matched: r.matched, ms: r.durationMs });
    } catch (e) {
      results.push({ vendor: v.name, ok: false, error: (e as Error).message });
    }
  }
  return NextResponse.json({ ran: results.length, results });
}
