import type { Application, Document } from '@/lib/supabase/types';
import { REQUIRED_DOCS } from '@/lib/claude/docTypes';
import type { Step } from '@/components/ui/StepIndicator';

type AppLite = Pick<
  Application,
  | 'status'
  | 'applicant_type'
  | 'applicant_name'
  | 'phone'
  | 'email'
  | 'line_display_name'
>;

type DocLite = Pick<Document, 'doc_type'>;

export type ProgressResult = {
  percent: number;
  currentStep: Step['id'];
  completedSteps: Step['id'][];
  docsUploaded: number;
  docsRequired: number;
};

export function computeProgress(app: AppLite, documents: DocLite[]): ProgressResult {
  // 送信済み or 完了は常に 100%
  if (app.status === 'submitted' || app.status === 'completed') {
    return {
      percent: 100,
      currentStep: 'complete',
      completedSteps: ['landing', 'info', 'documents', 'review'],
      docsUploaded: 0,
      docsRequired: 0,
    };
  }

  const hasType = !!app.applicant_type;
  const hasBasicInfo =
    hasType &&
    !!app.applicant_name &&
    !!app.phone &&
    !!app.email &&
    !!app.line_display_name;

  let docsRequired = 0;
  let docsUploaded = 0;
  if (app.applicant_type) {
    const required = REQUIRED_DOCS[app.applicant_type];
    docsRequired = required.length;
    docsUploaded = required.filter((t) => documents.some((d) => d.doc_type === t)).length;
  }
  const allDocsUploaded = docsRequired > 0 && docsUploaded >= docsRequired;

  // 状態ごとにステップと % を決定
  if (allDocsUploaded) {
    return {
      percent: 80,
      currentStep: 'review',
      completedSteps: ['landing', 'info', 'documents'],
      docsUploaded,
      docsRequired,
    };
  }
  if (hasBasicInfo) {
    const docProgress = docsRequired > 0 ? docsUploaded / docsRequired : 0;
    const percent = 40 + Math.round(docProgress * 40); // 40-80
    return {
      percent,
      currentStep: 'documents',
      completedSteps: ['landing', 'info'],
      docsUploaded,
      docsRequired,
    };
  }
  if (hasType) {
    return {
      percent: 20,
      currentStep: 'info',
      completedSteps: ['landing'],
      docsUploaded: 0,
      docsRequired,
    };
  }
  return {
    percent: 5,
    currentStep: 'landing',
    completedSteps: [],
    docsUploaded: 0,
    docsRequired,
  };
}
