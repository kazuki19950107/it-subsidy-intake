import { cn } from '@/lib/utils/cn';

type Props = {
  percent: number;
  label?: string;
  size?: 'sm' | 'md';
  showPercent?: boolean;
  className?: string;
};

export function ProgressBar({
  percent,
  label,
  size = 'md',
  showPercent = true,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const barH = size === 'sm' ? 'h-1' : 'h-1.5';
  // 色は 1 色（完了だけ緑）にして、表の中で色がばらつかないようにする
  const color = clamped >= 100 ? 'bg-emerald-500' : 'bg-zinc-800';

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-mute">{label}</span>}
          {showPercent && (
            <span className="text-xs font-semibold text-charcoal">{clamped}%</span>
          )}
        </div>
      )}
      <div className={cn('w-full bg-zinc-200/80 rounded-full overflow-hidden', barH)}>
        <div
          className={cn('h-full transition-all duration-500', color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
