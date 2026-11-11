import { NextResponse } from 'next/server';
import { listThreads } from '@/lib/line/threads';

export const dynamic = 'force-dynamic';

// トーク一覧（画面が定期的に読み直す）
export async function GET() {
  return NextResponse.json({ threads: await listThreads() });
}
