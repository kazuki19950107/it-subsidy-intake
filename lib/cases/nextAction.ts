// 案件の「次にやること」（純粋関数）。案件の詳細のいちばん上に、フェーズと次の一手を出すために使う。
// 上から順に見て、終わっていない最初の項目を「次にやること」にする。

export type NextActionInput = {
  /** 会社名・代表者・所在地がそろっているか */
  infoFilled: boolean;
  consent: 'none' | 'sent' | 'viewed' | 'signed';
  lineLinked: boolean;
  /** 申請フォームを送信したか（submitted 以降） */
  formSubmitted: boolean;
  staffReviewCount: number;
  portalLinked: boolean;
  /** ポータルの状態が不採択など（ここで終わり） */
  rejected: boolean;
  adopted: boolean;
  vendorSet: boolean;
  vendorContract: 'none' | 'sent' | 'viewed' | 'signed';
  vendorInvoice: boolean;
  grantDecided: boolean;
  billing: { issued: boolean; paid: boolean } | null;
};

export type Step = {
  key: string;
  phase: 1 | 2 | 3 | 4 | 5;
  /** 一覧に出す短い名前 */
  label: string;
  done: boolean;
  /** staff: 社内がやる / customer: お客様を待つ / auto: 自動で進むのを待つ */
  who: 'staff' | 'customer' | 'auto';
  /** 次にやることとして出す文 */
  action: string;
  /** 押したときに飛ぶ場所（ページ内の id か URL） */
  target: string;
  targetLabel: string;
};

export const PHASE_TITLES: Record<number, string> = {
  1: '受付〜同意書',
  2: '書類の回収',
  3: '申請〜採択',
  4: '採択後の契約・請求',
  5: '交付決定〜入金',
};

export function caseSteps(s: NextActionInput): Step[] {
  const consentDone = s.consent === 'signed';
  return [
    {
      key: 'info',
      phase: 1,
      label: '会社情報',
      done: s.infoFilled,
      who: 'staff',
      action: '会社名・代表者・所在地を入れて保存する',
      target: '#case-info',
      targetLabel: '案件の情報へ',
    },
    {
      key: 'consent_send',
      phase: 1,
      label: '同意書を送る',
      done: s.consent !== 'none',
      who: 'staff',
      action: '同意書を作って、署名URLをお客様に送る',
      target: '#consent',
      targetLabel: '同意書へ',
    },
    {
      key: 'consent_sign',
      phase: 1,
      label: '同意書の署名',
      done: consentDone,
      who: 'customer',
      action:
        s.consent === 'viewed'
          ? 'お客様が同意書を開きました。署名を待っています'
          : 'お客様の署名を待っています（まだなら署名URLを送ってください）',
      target: '#consent',
      targetLabel: '署名URLを見る',
    },
    {
      key: 'line',
      phase: 1,
      label: 'グループLINE',
      done: s.lineLinked,
      who: 'staff',
      action: 'お客様とのグループLINEを「3次BU×会社名様」の名前で作り、公式LINEを招待する',
      target: '#line-groups',
      targetLabel: 'グループLINEへ',
    },
    {
      key: 'docs',
      phase: 2,
      label: '書類の提出',
      done: s.formSubmitted,
      who: 'customer',
      action: 'お客様の書類の提出を待っています（まだなら申請URLを送ってください）',
      target: '#apply-url',
      targetLabel: '申請URLを見る',
    },
    {
      key: 'review',
      phase: 2,
      label: '書類の確認',
      done: s.formSubmitted && s.staffReviewCount === 0,
      who: 'staff',
      action: `「担当者確認が必要」な書類が${s.staffReviewCount}件あります。中身を確かめる`,
      target: '#documents',
      targetLabel: '書類へ',
    },
    {
      key: 'portal',
      phase: 3,
      label: 'ポータル申請・紐付け',
      done: s.portalLinked,
      who: 'staff',
      action: 'ポータルで申請し、交付申請番号を入れて紐付ける',
      target: '#portal-link',
      targetLabel: 'ポータル連携へ',
    },
    {
      key: 'adopted',
      phase: 3,
      label: '採択',
      done: s.adopted,
      who: 'auto',
      action: '採択を待っています（毎朝ポータルから自動で取り込みます）',
      target: '#portal-link',
      targetLabel: 'ポータル連携を見る',
    },
    {
      key: 'vendor_contract',
      phase: 4,
      label: '契約書（ベンダー）',
      done: s.vendorContract !== 'none',
      who: 'staff',
      action: s.vendorSet
        ? 'ベンダーとお客様の契約書を作って、署名URLを送る'
        : '案件の情報でベンダーを選び、契約書を作る',
      target: s.vendorSet ? '#vendor-docs' : '#case-info',
      targetLabel: s.vendorSet ? 'ベンダーの書類へ' : '案件の情報へ',
    },
    {
      key: 'vendor_invoice',
      phase: 4,
      label: '請求書（ベンダー）',
      done: s.vendorInvoice,
      who: 'staff',
      action: 'ベンダーからお客様への請求書を作る',
      target: '#vendor-docs',
      targetLabel: 'ベンダーの書類へ',
    },
    {
      key: 'vendor_sign',
      phase: 4,
      label: '契約書の署名',
      done: s.vendorContract === 'signed',
      who: 'customer',
      action: 'お客様の契約書への署名を待っています',
      target: '#vendor-docs',
      targetLabel: '署名URLを見る',
    },
    {
      key: 'billing_ready',
      phase: 5,
      label: '請求予定',
      done: !!s.billing,
      who: 'auto',
      action: s.grantDecided
        ? '請求のタイミング（補助金の入金など）を待っています'
        : '交付決定を待っています（毎朝ポータルから自動で取り込みます）',
      target: '#billing',
      targetLabel: '請求を見る',
    },
    {
      key: 'fee_invoice',
      phase: 5,
      label: 'フィーの請求書',
      done: !!s.billing?.issued,
      who: 'staff',
      action: 'ベンダーあてにフィーの請求書を作る',
      target: '/admin/billing',
      targetLabel: '売上・請求へ',
    },
    {
      key: 'paid',
      phase: 5,
      label: '入金',
      done: !!s.billing?.paid,
      who: 'staff',
      action: '入金されたら、入金日を入れる',
      target: '/admin/billing',
      targetLabel: '売上・請求へ',
    },
  ];
}

export type NextAction = {
  steps: Step[];
  /** 次にやること。全部終わった・不採択なら null */
  next: Step | null;
  /** いまのフェーズ（全部終わったら 6） */
  phase: number;
  /** 前のフェーズでやり残していること（先に進んでいる案件の、登録前の作業など） */
  leftovers: Step[];
  finished: 'done' | 'rejected' | null;
};

/**
 * 次にやること。すでに先のフェーズまで進んでいる案件（書類提出・ポータル紐付け・採択の事実）では、
 * それより前のフェーズの未完了は「やり残し」として分け、次にやることにはしない。
 */
export function nextAction(s: NextActionInput): NextAction {
  const steps = caseSteps(s);
  const base = s.adopted ? 4 : s.portalLinked ? 3 : s.formSubmitted ? 2 : 1;
  const leftovers = steps.filter((x) => !x.done && x.phase < base && x.who === 'staff');
  if (s.rejected) return { steps, next: null, phase: 3, leftovers: [], finished: 'rejected' };
  const next = steps.find((x) => !x.done && x.phase >= base) ?? null;
  return { steps, next, phase: next ? next.phase : 6, leftovers, finished: next ? null : 'done' };
}
