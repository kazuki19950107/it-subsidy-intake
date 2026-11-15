import { NextRequest, NextResponse } from 'next/server';
import { PortalSyncBusyError, syncVendorPortal } from '@/lib/portal/sync';

// ブラウザ操作を含むため長め
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await syncVendorPortal(id, 'manual');
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof PortalSyncBusyError) {
      return NextResponse.json({ error: e.message, busy: true }, { status: 409 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
