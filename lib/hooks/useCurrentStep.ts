'use client';
import { usePathname } from 'next/navigation';
import type { Step } from '@/components/ui/StepIndicator';

export function useCurrentStep(): Step['id'] {
  const pathname = usePathname();
  if (pathname.endsWith('/complete')) return 'complete';
  if (pathname.endsWith('/review')) return 'review';
  if (pathname.endsWith('/documents')) return 'documents';
  if (pathname.endsWith('/info') || pathname.endsWith('/type')) return 'info';
  return 'landing';
}
