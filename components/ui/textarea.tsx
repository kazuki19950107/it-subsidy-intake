import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[96px] w-full rounded-md border border-rule bg-white px-3 py-2 text-base text-charcoal placeholder:text-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:border-transparent disabled:cursor-not-allowed disabled:bg-off-white disabled:opacity-60',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
