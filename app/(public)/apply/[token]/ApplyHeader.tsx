'use client';

import { StepIndicator, type Step } from '@/components/ui/StepIndicator';
import { useCurrentStep } from '@/lib/hooks/useCurrentStep';

export function ApplyHeader({
  token,
  displayName,
  shortId,
  percent,
  completedSteps,
}: {
  token: string;
  displayName: string;
  shortId: string;
  percent?: number;
  completedSteps?: Step['id'][];
}) {
  const currentStep = useCurrentStep();
  return (
    <header className="bg-white border-b border-rule sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-teal-dark">IT補助金申請</div>
          <div className="text-xs text-mute">
            申請ID: <span className="font-mono">{shortId}</span>
            <span className="mx-2">·</span>
            <span>{displayName}</span>
          </div>
        </div>
        <StepIndicator
          currentStep={currentStep}
          token={token}
          percent={percent}
          completedSteps={completedSteps}
        />
      </div>
    </header>
  );
}
