import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-1.5 py-px text-[11px] font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-zinc-200 bg-zinc-50 text-zinc-700',
        secondary: 'border-sky-200 bg-sky-50 text-sky-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        destructive: 'border-rose-200 bg-rose-50 text-rose-700',
        outline: 'border-rule bg-white text-charcoal',
        muted: 'border-zinc-200 bg-white text-zinc-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
