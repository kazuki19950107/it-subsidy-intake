// 管理画面のページ一覧（メニューと「使い方」ページの両方がここを読む）。
// 新しい管理画面を作ったら必ずここに足すこと。足し忘れると tests/adminPages.test.ts が失敗する。
import {
  BookOpen,
  Building2,
  Download,
  FileText,
  JapaneseYen,
  Landmark,
  MessageCircle,
  MessagesSquare,
  Plus,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react';

export type AdminPage = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 使い方ページの「画面の一覧」に出す説明 */
  description: string;
  /** 上部メニューに出すか */
  nav: boolean;
  /** 画面ではなくファイルのダウンロードなど */
  external?: boolean;
};

export const ADMIN_PAGES: AdminPage[] = [
  { href: '/admin/dashboard', label: '案件一覧', icon: FileText, nav: true, description: '全案件の段階・ポータル状態・次の期限を一覧。絞り込みと並べ替え' },
  { href: '/admin/dashboard/new', label: '新規登録', icon: Plus, nav: true, description: '案件を登録し、申請URLと同意書の署名URLを発行' },
  { href: '/admin/portal', label: 'ポータル案件', icon: Landmark, nav: true, description: 'ポータルから取り込んだ案件と、手動の同期' },
  { href: '/admin/billing', label: '売上・請求', icon: JapaneseYen, nav: true, description: '請求予定・請求書（PDF）の作成・入金日の記録と、売上見込みの集計' },
  { href: '/admin/talk', label: 'トーク', icon: MessagesSquare, nav: true, description: 'お客様・社内のLINEグループの会話を見て、ここから返信する（LINEと同じ見た目）' },
  { href: '/admin/line', label: 'LINE', icon: MessageCircle, nav: true, description: 'グループの紐付け・社内用グループの指定・送れなかった通知' },
  { href: '/admin/settings', label: '設定', icon: Settings, nav: true, description: '段階・チェック項目・ツールとフィー・社内担当・書類の判定・請求書（請求元・振込先・税）' },
  { href: '/admin/vendors', label: 'ベンダー', icon: Building2, nav: true, description: 'ベンダーとポータルのログイン情報・お客様へ出す請求書と契約書の発行元の情報' },
  { href: '/admin/import', label: 'CSV一括登録', icon: Upload, nav: false, description: '既存の案件をCSVでまとめて登録（案件一覧の右上から開く）' },
  { href: '/api/admin/export?format=csv', label: 'CSVで出力', icon: Download, nav: false, external: true, description: '全案件を CSV でダウンロード（段階・ツール・補助金額・フィー・ポータルの状態・節目の日付・請求と入金。案件一覧の右上から）' },
  { href: '/admin/guide', label: '使い方', icon: BookOpen, nav: true, description: 'このページ' },
];

export const NAV_ITEMS = ADMIN_PAGES.filter((p) => p.nav);
