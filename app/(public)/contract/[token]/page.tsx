import { notFound } from 'next/navigation';
import { getContractByToken, markViewed } from '@/lib/contracts/service';
import { SignForm } from './SignForm';

export const dynamic = 'force-dynamic';

export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);
  if (!contract) notFound();
  await markViewed(contract);

  return (
    <div className="min-h-screen bg-off-white">
      <header className="bg-white border-b border-rule">
        <div className="max-w-3xl mx-auto px-4 py-3 text-sm font-bold text-ink">同意書のご確認と署名</div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {contract.status === 'void' ? (
          <div className="bg-white rounded-md border border-rule p-6 text-sm">
            この同意書は無効になっています（内容の修正により新しい同意書が作られた可能性があります）。担当者にお問い合わせください。
          </div>
        ) : (
          <>
            <ol className="flex gap-2 text-xs text-mute">
              <li className="font-semibold text-ink">1. 内容の確認</li>
              <li>→</li>
              <li className={contract.status === 'signed' ? '' : 'font-semibold text-ink'}>2. 署名</li>
              <li>→</li>
              <li className={contract.status === 'signed' ? 'font-semibold text-ink' : ''}>3. 締結</li>
            </ol>
            <article className="bg-white rounded-md border border-rule p-6 leading-relaxed text-sm text-charcoal">
              <h1 className="text-lg font-bold text-ink text-center mb-6">{contract.title}</h1>
              <div className="space-y-3 [&_p]:whitespace-normal" dangerouslySetInnerHTML={{ __html: contract.body_html }} />
            </article>
            {contract.status === 'signed' ? (
              <div className="bg-white rounded-md border border-ok p-6 text-sm space-y-2">
                <div className="font-bold text-ok">締結済みです</div>
                <div>
                  署名者: {contract.signer_name}／署名日時:{' '}
                  {contract.signed_at ? new Date(contract.signed_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                </div>
                <a className="text-teal hover:underline" href={`/api/contracts/${token}/pdf`}>
                  締結済みの同意書（PDF）をダウンロード
                </a>
              </div>
            ) : (
              <SignForm token={token} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
