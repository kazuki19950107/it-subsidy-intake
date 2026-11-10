'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/admin/pages';

export function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  // いま開いている画面（より長く一致したものを優先。/admin/dashboard/new が案件一覧と両方光らないように）
  const activeHref = NAV_ITEMS.filter((i) => !i.external && (pathname === i.href || pathname.startsWith(i.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
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
      <nav className="hidden lg:flex items-center gap-1 text-sm">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          const className = `px-2.5 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-colors text-[13px] ${
            active ? 'bg-zinc-100 text-ink font-medium' : 'text-zinc-500 hover:text-ink hover:bg-zinc-50'
          }`;
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
          className="ml-1 p-2 rounded-md text-zinc-400 hover:text-ink hover:bg-zinc-50 disabled:opacity-50"
          title="ログアウト"
          aria-label="ログアウト"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="lg:hidden p-2 -mr-2 rounded hover:bg-off-white"
        aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="lg:hidden absolute left-0 right-0 top-full bg-white border-b border-rule shadow-md z-40">
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
