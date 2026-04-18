import Link from 'next/link';
import { AdminNav } from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white">
      <header className="bg-white border-b border-rule relative">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-teal rounded-sm flex items-center justify-center text-white font-bold text-sm shrink-0">
              AZ
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink leading-tight truncate">
                IT補助金申請 管理画面
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
