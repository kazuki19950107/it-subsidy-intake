import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-rule bg-white px-3 py-1.5 text-base text-ink placeholder:text-zinc-400 shadow-[0_1px_0_rgba(0,0,0,0.02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 disabled:cursor-not-allowed disabled:bg-off-white disabled:opacity-60',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
