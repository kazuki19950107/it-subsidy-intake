'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

export type Step = {
  id: 'landing' | 'info' | 'documents' | 'review' | 'complete';
  label: string;
  description?: string;
};

export const APPLY_STEPS: Step[] = [
  { id: 'landing', label: 'はじめに', description: '案内の確認' },
  { id: 'info', label: '基本情報', description: '区分と連絡先' },
  { id: 'documents', label: '書類提出', description: '画像アップロード' },
  { id: 'review', label: '確認', description: '内容の最終確認' },
  { id: 'complete', label: '完了', description: '送信済み' },
];

type Props = {
  currentStep: Step['id'];
  completedSteps?: Step['id'][];
  token?: string;
  /** 外部から計算した進捗 % を渡す場合。省略時はステップ位置から算出 */
  percent?: number;
};

function stepStatus(
  step: Step['id'],
  current: Step['id'],
  completed: Step['id'][],
): 'completed' | 'current' | 'upcoming' {
  if (step === current) return 'current';
  if (completed.includes(step)) return 'completed';
  const currentIdx = APPLY_STEPS.findIndex((s) => s.id === current);
  const stepIdx = APPLY_STEPS.findIndex((s) => s.id === step);
  if (stepIdx < currentIdx) return 'completed';
  return 'upcoming';
}

function stepPath(token: string, step: Step['id']): string {
  switch (step) {
    case 'landing':
      return `/apply/${token}`;
    case 'info':
      return `/apply/${token}/info`;
    case 'documents':
      return `/apply/${token}/documents`;
    case 'review':
      return `/apply/${token}/review`;
    case 'complete':
      return `/apply/${token}/complete`;
  }
}

export function StepIndicator({ currentStep, completedSteps = [], token, percent }: Props) {
  const pathname = usePathname();
  const tokenFromPath = (() => {
    if (token) return token;
    const m = pathname.match(/^\/apply\/([^/]+)/);
    return m?.[1] ?? '';
  })();
  const currentIdx = APPLY_STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent =
    percent ?? Math.round(((currentIdx + 1) / APPLY_STEPS.length) * 100);

  return (
    <nav aria-label="申請ステップ">
      {/* Desktop の進捗バー */}
      <div className="hidden md:flex items-center justify-between mb-3">
        <div className="text-xs text-mute">
          進捗 <span className="font-semibold text-teal-dark">{progressPercent}%</span>
        </div>
        <div className="flex-1 mx-4 h-1.5 bg-rule rounded-full overflow-hidden">
          <div
            className="h-full bg-teal transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-mute">
          ステップ {currentIdx + 1} / {APPLY_STEPS.length}
        </div>
      </div>

      {/* Desktop */}
      <ol className="hidden md:flex items-stretch gap-0">
        {APPLY_STEPS.map((step, idx) => {
          const status = stepStatus(step.id, currentStep, completedSteps);
          // complete は送信済みでなければクリック不可。それ以外（landing/info/documents/review）は自由に行き来可
          const isComplete = step.id === 'complete';
          const completeReached = completedSteps.includes('complete') || currentStep === 'complete';
          const isClickable = tokenFromPath && (!isComplete || completeReached) && status !== 'current';
          const href = tokenFromPath ? stepPath(tokenFromPath, step.id) : '#';

          const badge = (
            <span
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all',
                status === 'completed' && 'bg-teal text-white',
                status === 'current' &&
                  'bg-teal text-white ring-4 ring-teal-light animate-pulse-ring',
                status === 'upcoming' &&
                  'bg-white border-2 border-rule text-mute',
              )}
              aria-hidden
            >
              {status === 'completed' ? (
                <Check className="w-5 h-5 animate-scale-in" />
              ) : (
                <span>{idx + 1}</span>
              )}
            </span>
          );

          const content = (
            <div className="flex flex-col items-center text-center min-w-0">
              {badge}
              <div className="mt-2">
                <div
                  className={cn(
                    'text-sm font-semibold',
                    status === 'current' && 'text-teal-dark',
                    status === 'upcoming' && 'text-mute',
                    status === 'completed' && 'text-charcoal',
                  )}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-[11px] text-mute mt-0.5">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <li
              key={step.id}
              className="flex-1 flex items-start min-w-0"
              {...(status === 'current' ? { 'aria-current': 'step' } : {})}
            >
              {isClickable ? (
                <Link
                  href={href}
                  className="flex flex-col items-center w-full hover:opacity-80"
                >
                  {content}
                </Link>
              ) : (
                <div
                  className={cn(
                    'flex flex-col items-center w-full',
                    isComplete && !completeReached && 'pointer-events-none opacity-50',
                  )}
                >
                  {content}
                </div>
              )}
              {idx < APPLY_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mt-[18px] mx-1">
                  <div
                    className={cn(
                      'h-full',
                      stepStatus(APPLY_STEPS[idx + 1].id, currentStep, completedSteps) !==
                        'upcoming' || status === 'completed'
                        ? 'bg-teal'
                        : 'bg-rule',
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-mute">
            ステップ {currentIdx + 1} / {APPLY_STEPS.length} ・ {progressPercent}%
          </div>
        </div>
        <div className="relative h-1.5 bg-rule rounded-full overflow-hidden mb-3">
          <div
            className="absolute inset-y-0 left-0 bg-teal transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-center">
          <div className="text-base font-semibold text-teal-dark">
            {APPLY_STEPS[currentIdx]?.label}
          </div>
          <div className="text-xs text-mute mt-0.5">
            {APPLY_STEPS[currentIdx]?.description}
          </div>
        </div>
      </div>
    </nav>
  );
}
