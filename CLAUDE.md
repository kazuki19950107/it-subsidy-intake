# CLAUDE.md

AI導入補助金の申請代行（Assemble）の案件管理システム。システム名は **Tsumugi**（ロゴは `components/brand/Logo.tsx`）。Next.js 15 (App Router) + Supabase + Claude API + LINE Messaging API、Vercel にデプロイ。
仕様は `docs/spec-case-management.md`、起動と確認の手順は `README.md`。

## 使い方ページを必ず更新する

管理画面の使い方ページ `app/admin/(secure)/guide/page.tsx`（`/admin/guide`）は、スタッフが実際に読む説明書。機能を足す・変えるときは、同じ変更の中で次を必ず行う。

- **新しい管理画面を作ったら** `lib/admin/pages.ts` の `ADMIN_PAGES` に追加する（メニューと使い方の「画面の一覧」はここを読む）。足し忘れると `tests/adminPages.test.ts` が失敗する。
- **流れ・通知・判定・手順が変わったら** 使い方ページの該当する節（全体の流れ・登録と同意書・書類・グループLINE・ポータル同期・チェック項目・フィーと請求・毎日の使い方・こんなときは）の文章と図を直す。
- 段階・チェック項目・ツールとフィー・書類の判定条件は、設定（DB）から読んで表示しているので手で書かない。新しい設定項目を作ったら、それも DB から読んで使い方に表示する。

## 開発のルール

- 文章や画面の文言は、やさしい日本語で書く（専門用語を避け、短い文で）。
- DB の変更は `supabase/migrations/` に新しいファイルを追加し、本番は Supabase の SQL Editor で実行する（実行前にユーザーに確認）。新しい表は RLS 有効・許可ルール無し（サーバー側の service role 経由のみ）。
- `main` に push すると本番にデプロイされる。push の前にユーザーに確認する。
- 変更のあとは `npm test` と `npm run build` を通す。
- LINE は無料プラン（月200通）。push 送信を増やす変更は慎重に。
