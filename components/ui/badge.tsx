import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-teal text-white',
        secondary: 'border-transparent bg-teal-light text-teal-dark',
        success: 'border-transparent bg-ok text-white',
        warning: 'border-transparent bg-warn text-white',
        destructive: 'border-transparent bg-accent text-white',
        outline: 'border-rule text-charcoal',
        muted: 'border-rule bg-off-white text-mute',
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
