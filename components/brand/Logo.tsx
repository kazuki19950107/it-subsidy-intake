// ロゴ。4 つのブロックを組み上げたマーク（申請に必要なものを"組み立てる"）と、文字のロゴ。
// 色は文字と同じ黒 1 色＋差し色 1 つだけにして、グラデーションや頭文字の箱は使わない。

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="3" width="12" height="12" rx="3" fill="currentColor" />
      <rect x="17" y="3" width="12" height="12" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="3" y="17" width="12" height="12" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="17" y="17" width="12" height="12" rx="6" fill="#e5532d" />
    </svg>
  );
}

export function Logo({ sub = '補助金 案件管理', className = '' }: { sub?: string | null; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-ink ${className}`}>
      <LogoMark />
      <span className="flex items-baseline gap-2 leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Assemble</span>
        {sub && <span className="hidden sm:inline text-[12px] text-mute font-medium">{sub}</span>}
      </span>
    </span>
  );
}
