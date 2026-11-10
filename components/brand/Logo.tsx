// ロゴ。システム名は Tsumugi（紡ぎ）。書類・LINE・ポータル・請求を一本の糸のようにつなぐ、という意味。
// マークは点をつないで流れる 1 本の糸と、結び目（朱）。黒 1 色＋差し色 1 つだけで、グラデーションは使わない。

export const SYSTEM_NAME = 'Tsumugi';

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  // 1 本の糸が点（書類・LINE・ポータル）を通って流れ、最後に結び目（朱）で終わる
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" />
      <path
        d="M7.5 21.5 C 10.5 21.5, 11 10.5, 15.5 10.5 S 19.5 21.5, 24 15"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="21.5" r="2.1" fill="#ffffff" />
      <circle cx="24.2" cy="14.6" r="3" fill="#e5532d" />
    </svg>
  );
}

export function Logo({ sub = '補助金 案件管理', className = '' }: { sub?: string | null; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-ink ${className}`}>
      <LogoMark />
      <span className="flex items-baseline gap-2 leading-none">
        <span className="text-[16px] font-semibold tracking-[-0.02em]">{SYSTEM_NAME}</span>
        {sub && <span className="hidden sm:inline text-[12px] text-mute font-medium">{sub}</span>}
      </span>
    </span>
  );
}
