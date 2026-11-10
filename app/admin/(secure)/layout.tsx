import Link from 'next/link';
import { AdminNav } from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-rule">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
              AZ
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink leading-tight truncate">
                補助金 案件管理
              </div>
              <div className="text-[11px] text-mute">AzCreate</div>
            </div>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
