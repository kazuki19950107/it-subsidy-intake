/** 申請一覧の ?vendor= で「ベンダー未設定」を表す値（server / client 双方から参照） */
export const VENDOR_FILTER_NONE = 'none';

/** 申請一覧の ?status= の値。未指定は 'open'（送信済・完了を除く対応中のみ） */
export const STATUS_FILTER_DEFAULT = 'open';
export const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'open', label: '対応中のみ（送信済・完了を除く）' },
  { value: 'all', label: 'すべて' },
  { value: 'draft', label: '入力中' },
  { value: 'review', label: '確認待ち' },
  { value: 'rejected', label: '差戻し' },
  { value: 'submitted', label: '送信済' },
  { value: 'completed', label: '完了' },
];
/** 'open' で除外するステータス */
export const CLOSED_STATUSES = new Set(['submitted', 'completed']);
