// ロゴ。システム名は Tsumugi（紡ぎ）。書類・LINE・ポータル・請求を一本の糸のようにつなぐ、という意味。
// マークは縦糸と横糸が交差する織り目。黒 1 色＋差し色（朱）1 本だけで、グラデーションは使わない。

export const SYSTEM_NAME = 'Tsumugi';

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" />
      {/* 縦糸 */}
      <g stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
        <line x1="11" y1="7" x2="11" y2="25" />
        <line x1="21" y1="7" x2="21" y2="25" />
      </g>
      {/* 横糸（上を通る所・下をくぐる所を交互にして織り目にする） */}
      <g strokeWidth="2.6" strokeLinecap="round">
        <path d="M7 12 H9 M13 12 H25" stroke="#ffffff" />
        <path d="M7 20 H19 M23 20 H25" stroke="#e5532d" />
      </g>
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
