import Link from 'next/link';
import { AdminNav } from './AdminNav';
import { Logo } from '@/components/brand/Logo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-rule">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/admin/dashboard" className="shrink-0" aria-label="案件一覧へ">
            <Logo />
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
