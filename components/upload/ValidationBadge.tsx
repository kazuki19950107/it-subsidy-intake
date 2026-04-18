import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export function ValidationBadge({ errors }: { errors: CrossCheckResult[] }) {
  const hasError = errors.some((e) => e.level === 'error');
  const hasWarning = errors.some((e) => e.level === 'warning');

  if (hasError) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        エラー {errors.filter((e) => e.level === 'error').length}件
      </Badge>
    );
  }
  if (hasWarning) {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        要確認 {errors.filter((e) => e.level === 'warning').length}件
      </Badge>
    );
  }
  if (errors.length > 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Info className="w-3 h-3" />
        情報 {errors.length}件
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="w-3 h-3" />
      OK
    </Badge>
  );
}

export function ValidationList({ errors }: { errors: CrossCheckResult[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-2 mt-3">
      {errors.map((err, i) => (
        <li
          key={i}
          className={
            err.level === 'error'
              ? 'text-sm p-2 rounded bg-red-50 border-l-4 border-accent text-accent'
              : err.level === 'warning'
                ? 'text-sm p-2 rounded bg-amber-50 border-l-4 border-warn text-[#8a5a09]'
                : 'text-sm p-2 rounded bg-off-white border-l-4 border-rule text-charcoal'
          }
        >
          {err.message}
        </li>
      ))}
    </ul>
  );
}
