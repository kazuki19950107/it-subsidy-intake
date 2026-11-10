import { Logo } from '@/components/brand/Logo';
import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ログイン | Tsumugi' };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/admin/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-off-white">
      <div className="w-full max-w-sm bg-white border border-rule rounded-lg p-6 space-y-4">
        <Logo />

        <div>
          <h1 className="text-lg font-bold text-ink">管理者ログイン</h1>
          <p className="text-xs text-mute mt-1">
            管理者用パスワードを入力してください。
          </p>
        </div>

        <LoginForm next={next} />

        <div className="pt-2 border-t border-rule">
          <Link href="/" className="text-xs text-mute hover:text-teal">
            ← トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
