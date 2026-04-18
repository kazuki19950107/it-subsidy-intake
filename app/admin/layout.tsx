import Link from 'next/link';
import { FileText, Plus, Download } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white">
      <header className="bg-white border-b border-rule">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal rounded-sm flex items-center justify-center text-white font-bold text-sm">
              AZ
            </div>
            <div>
              <div className="text-sm font-bold text-ink leading-tight">IT補助金申請 管理画面</div>
              <div className="text-[11px] text-mute">AzCreate</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/admin/dashboard"
              className="px-3 py-1.5 rounded hover:bg-teal-light flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              申請一覧
            </Link>
            <Link
              href="/admin/dashboard/new"
              className="px-3 py-1.5 rounded hover:bg-teal-light flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              新規URL発行
            </Link>
            <a
              href="/api/admin/export?format=csv"
              className="px-3 py-1.5 rounded hover:bg-teal-light flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              CSV
            </a>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
