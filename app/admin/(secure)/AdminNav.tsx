'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Download, Menu, X, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: '申請一覧', icon: FileText, external: false },
  { href: '/admin/dashboard/new', label: '新規URL発行', icon: Plus, external: false },
  { href: '/api/admin/export?format=csv', label: 'CSV', icon: Download, external: true },
];

export function AdminNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-2 text-sm">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const className =
            'px-3 py-1.5 rounded hover:bg-teal-light flex items-center gap-1';
          return item.external ? (
            <a key={item.href} href={item.href} className={className}>
              <Icon className="w-4 h-4" />
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-3 py-1.5 rounded hover:bg-teal-light flex items-center gap-1 text-mute hover:text-ink disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="md:hidden p-2 -mr-2 rounded hover:bg-off-white"
        aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-b border-rule shadow-md z-40">
          <nav className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const className =
                'flex items-center gap-2 px-4 py-3 text-sm hover:bg-off-white border-b border-rule/50 last:border-b-0';
              return item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              disabled={loggingOut}
              className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-off-white text-mute disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
