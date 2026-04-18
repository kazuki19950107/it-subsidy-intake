import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-off-white">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-bold text-ink">IT補助金申請 受付システム</h1>
        <p className="text-sm text-mute">
          このサイトは、AzCreate からご案内した専用URLからのみご利用いただけます。
        </p>
        <div className="pt-4">
          <Link href="/admin/dashboard" className="text-sm text-teal hover:underline">
            管理者の方はこちら →
          </Link>
        </div>
      </div>
    </div>
  );
}
