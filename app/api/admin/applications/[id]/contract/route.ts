import { NextRequest, NextResponse } from 'next/server';
import { ContractError, contractUrl, createContractForCase } from '@/lib/contracts/service';
import { addHistory } from '@/lib/cases/service';

// 同意書を作る・作り直す（未署名のものは無効になる。締結済みなら作らない）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const c = await createContractForCase(id);
    if (!c) return NextResponse.json({ error: '締結済みの同意書があるため作り直せません' }, { status: 409 });
    await addHistory(id, 'contract', null, '同意書を作成', { type: 'staff' });
    return NextResponse.json({ ok: true, contract_url: contractUrl(c.token) });
  } catch (e) {
    if (e instanceof ContractError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
