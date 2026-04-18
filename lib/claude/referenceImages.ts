import type { DocType } from '@/lib/supabase/types';

export type ReferenceImage = {
  src: string;
  caption: string;
  notes?: string[];
};

/** 書類種別ごとのメイン参考画像（ポイント解説付きサンプル） */
export const DOC_REFERENCE_IMAGES: Partial<Record<DocType, ReferenceImage>> = {
  certificate_of_history: {
    src: '/references/S__66338865_0.jpg',
    caption: '履歴事項全部証明書 サンプル',
    notes: ['発行から3ヶ月以内のものをご用意ください', '法務局で取得できます'],
  },
  tax_cert_1: {
    src: '/references/S__66338866_0.jpg',
    caption: '納税証明書 その1（法人税）サンプル',
    notes: [
      '税目が「法人税」であることを確認してください',
      '消費税等の証明書は認められません',
      '税務署が発行しているものを提出してください',
      '申請時点で取得できる直近分を取得してください',
    ],
  },
  financial_statements: {
    src: '/references/S__66338867_0.jpg',
    caption: '決算書（損益計算書 + 販管費 + 貸借対照表）サンプル',
    notes: [
      '損益計算書（P/L）',
      '販売費及び一般管理費の内訳',
      '貸借対照表（B/S）の3点すべてが必要です',
    ],
  },
  tax_return: {
    src: '/references/S__66338870.jpg',
    caption: '所得税及び復興特別所得税の確定申告書（第一表）サンプル',
    notes: [
      '上部に電子申告の受付日時があることを確認してください',
      '受付日時の記載がない場合は、税務署の受領印または受信通知を併せてご提出ください',
    ],
  },
  blue_form: {
    src: '/references/S__66338871.jpg',
    caption: '所得税青色申告決算書 サンプル',
    notes: [
      '確定申告書一式の中にあります',
      '赤枠部分の数字が必要です',
      '白色申告の収支内訳書でも提出可能です',
    ],
  },
  e_tax_receipt: {
    src: '/references/S__66338870.jpg',
    caption: '電子申告 受信通知（通知詳細）サンプル',
    notes: [
      '確定申告書に受付印・電子申告の受付日時がない場合のみ必要です',
      '受付番号・受付日時が記載された画面をスクリーンショットしてください',
    ],
  },
  tax_cert_2: {
    src: '/references/S__66338872.jpg',
    caption: '納税証明書 その2（所得税）サンプル',
    notes: [
      '税目が「申告所得税及復興特別所得税」であることを確認してください',
      '消費税等は認められません',
      '申請時点で取得できる直近分を取得してください',
    ],
  },
};

/** 書類種別ごとの補足参考画像（メイン画像に加えて表示する付帯資料） */
export const DOC_SUPPLEMENTARY_IMAGES: Partial<Record<DocType, ReferenceImage[]>> = {
  tax_cert_1: [
    {
      src: '/references/S__66338868_0.jpg',
      caption: '納税証明書交付請求書（法人向け 記入例）',
      notes: ['税務署で納税証明書を請求する際の書き方サンプルです'],
    },
  ],
};
