import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-rule bg-white px-3 py-2 text-base text-charcoal placeholder:text-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:border-transparent disabled:cursor-not-allowed disabled:bg-off-white disabled:opacity-60',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
