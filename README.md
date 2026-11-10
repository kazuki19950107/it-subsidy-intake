# IT補助金申請 受付システム (MVP)

IT補助金申請のLINEサポート開始前に、申請者から必要書類（画像）と基本情報を収集し、Claude APIで書類内容を自動抽出・検証するWebシステム。

## 技術スタック

- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui + lucide-react
- Supabase (Postgres + Storage + Auth)
- Anthropic Claude API (`claude-sonnet-4-5-20250929`)
- Zod + react-hook-form
- pdfjs-dist (PDF→画像化)
- Vercel デプロイ / pnpm

## セットアップ

### 1. 依存インストール

```bash
pnpm install
```

### 2. 環境変数設定

`.env.local.example` を `.env.local` にコピーして値を設定：

```bash
cp .env.local.example .env.local
```

必要な値：
- Supabase プロジェクトの URL, anon key, service role key
- Anthropic API キー
- 管理者メールドメイン

### 3. Supabaseセットアップ

```bash
# プロジェクト作成後
pnpm supabase link --project-ref <your-project-ref>
pnpm supabase db push              # migrations 実行
pnpm supabase db seed              # seed 投入

# 型生成
pnpm supabase gen types typescript --project-id <your-project-ref> > lib/supabase/types.ts
```

### 4. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000 にアクセス。

### 5. ビルド・型チェック

```bash
pnpm build
pnpm typecheck
pnpm lint
```

## 使用フロー

### 管理者

1. `/admin/login` でログイン（Supabase Auth、メールドメイン制限あり）
2. `/admin/dashboard/new` で申請URLを発行 → 申請者にLINE等で共有
3. 申請者の送信後、`/admin/dashboard` に一覧表示
4. `/admin/dashboard/[id]` で抽出結果・原本を確認、必要なら差戻し
5. 書類ZIP一括DL、CSV出力

### 申請者

1. 管理者から共有されたURL `/apply/[token]` を開く
2. ステップ1 はじめに → 案内確認
3. ステップ2 基本情報 → 法人 / 個人事業主 区分選択 + 共通情報入力
4. ステップ3 書類提出 → 区分ごとの必要書類をアップロード、Claudeが自動解析
5. ステップ4 確認 → 抽出結果確認、必要なら修正、クロスチェック結果確認
6. ステップ5 完了 → 送信完了画面

## ディレクトリ構成

```
app/               - Next.js App Router
  (public)/apply   - 申請者画面
  (admin)          - 管理画面
  api/             - API Routes
components/
  ui/              - shadcn/ui ベース + StepIndicator
  forms/           - フォーム
  upload/          - アップロード系
  admin/           - 管理画面
lib/
  supabase/        - Supabase クライアント
  claude/          - Claude API + 書類別抽出
  validation/      - Zod + クロスチェック
  pdf/             - PDF→画像変換
  utils/           - トークン、日付、コストガード
supabase/
  migrations/      - スキーマ
  seed.sql         - 初期データ
prompts/           - 書類種別ごとの解析プロンプト
sample-documents/  - 検証用サンプル画像
```

## デプロイ (Vercel)

1. Vercel にリポジトリ連携
2. 環境変数をすべて Vercel に設定（`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` は Sensitive 扱い）
3. Build Command: `pnpm build`
4. Node.js バージョン: 20 以上

## 絶対に守ること

- **GビズIDのパスワード入力欄は作らない**
- **書類画像のURLは必ず signed URL（有効期限付き）**
- **ANTHROPIC_API_KEY をクライアントに露出させない**
- **個人情報は localStorage 禁止**
- **エラーメッセージは必ず日本語＆具体的に**
- **OCR抽出結果は必ず編集可能**
- **同一ファイルの重複解析は file_hash でキャッシュ**

## 案件管理（2026-11 追加）

書類提出フォームに加えて、案件の段階・チェック項目・フィー・同意書・公式LINE・請求予定を管理します。
仕様: `docs/spec-case-management.md` / DB: `supabase/migrations/20261110000000_case_management.sql`

### 画面

| 画面 | 内容 |
| --- | --- |
| `/admin/dashboard` | 案件一覧（段階・未完了のチェック・ポータル状態・回次で絞り込み、次の期限順などで並べ替え） |
| `/admin/dashboard/new` | 案件の登録（会社名を入れると同意書も作成） |
| `/admin/dashboard/[id]` | 案件の情報・段階・節目の日付・フィー、チェック項目、同意書、LINEグループ、請求、変更履歴 |
| `/admin/import` | CSVで既存案件を一括登録（Shift_JIS / UTF-8） |
| `/admin/billing` | 請求予定（請求書発行日・入金日）と売上見込み（ツール別・回次別・月別） |
| `/admin/line` | 公式LINEのグループ（社内用の指定・案件への紐付け）と送れなかった通知 |
| `/admin/settings` | 段階・チェック項目・ツールとフィー・社内担当・書類の判定 |
| `/contract/[token]` | 顧客向けの同意書の確認と署名（ログイン不要） |

### 仕組みの要点

- **段階と節目**: 段階に「節目」（同意書の締結・書類の提出・申請完了・採択・交付決定・補助金の入金）を持たせる。節目に達すると、その段階へ自動で進む（先へだけ）。段階に入ると節目の日付が入る。
- **ポータル連動**: 段階の「ポータル連動」の語がポータルの状態に含まれていたら、その段階へ進める（最も長く一致した語を優先）。
- **ポータル同期**: 取得は従来どおり（1日1回 JST 6時＋手動）。照合は申請番号 → 法人番号（一致すれば申請番号を自動設定）→ 会社名（候補のみ・詳細画面で確定）。前回との差分を `status_history` に残し、変化をまとめて社内用グループへ1通。取得に失敗したらすぐ通知。cron はあわせて LINE のグループ名を取り直す。
- **フィー**: 採択で見込み額、交付決定で確定額。補助金額・ツールが変わると計算し直す。ツールの請求タイミングに達すると `billing_schedules` に請求予定を作り、チェック「請求書発行」を立てる。請求書サービスは `lib/billing/invoiceProvider.ts` に差し込む（今は手入力）。
- **同意書**: 文面は `lib/contracts/template.ts`（仮。差し替えたら `TEMPLATE_VERSION` を上げる）。署名時に Chromium で PDF を作り、SHA-256・署名日時・IP・署名者を保存。認定タイムスタンプは `lib/contracts/timestamp.ts` に差し込む。
- **書類の判定**: 判定の中身はコード、数値・選択肢（登記簿の期限・納税証明書の種類（既定 その3）・決算書にそろえる書類など）は設定画面で変更。登録済みの会社名・法人番号と一致しない書類は不備。読み取りの信頼度が低い書類は「担当者確認が必要」。
- **LINE**: 無料プラン前提。参加時の挨拶は応答メッセージ（通数を使わない）。push は社内通知と、段階で「顧客に通知」をオンにしたときだけ。送れなかった通知は `/admin/line` に残り再送できる。

### 初期設定

1. Supabase の SQL Editor で `supabase/migrations/20261110000000_case_management.sql` を実行（実行済みなら不要）
2. Vercel に `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（任意で `AGENT_COMPANY_NAME`）を設定
3. LINE Developers で Webhook URL `https://<本番ドメイン>/api/line/webhook` を登録し、Webhook をオン、「グループトーク・複数人トークへの参加を許可する」をオン
4. 公式LINEと担当者だけのグループを作って公式LINEを招待し、`/admin/line` で「社内用にする」
5. `/admin/settings` で社内担当を登録し、段階・チェック項目を必要に応じて調整

### 動作確認の手順

1. `npm test`（グループ名の解析・会社名の正規化と照合・フィー計算・ポータルの差分・CSV・同意書の差し込み・書類の判定設定・売上集計）
2. `npm run build`
3. `/admin/dashboard/new` で会社名・法人番号・ツール・回次を入れて登録 → 同意書の署名URLが出る
4. 署名URLを開き、氏名を入れて署名 → 締結済みPDFが開ける。案件の段階が「書類回収中」に進み、変更履歴に残る
5. 案件の詳細で補助金額を入れ、節目「採択」の日付を入れて保存 → フィー見込み額が出る。「交付決定」で確定額、「補助金の入金」（BU/LU の請求タイミング）で `/admin/billing` に請求予定とチェック「請求書発行」が出る
6. `/admin/billing` で請求書発行日・入金日を入れる → チェックが完了になる。売上見込みに反映される
7. ポータルの「今すぐ同期」→ 状態が変わった案件は変更履歴に残り、段階のポータル連動で進む
8. LINE: グループ名を `3次BU×<会社名>様` にしたグループに公式LINEを招待 → `/admin/line` で自動で紐付く。書類提出フォームで送信 → 社内用グループに通知
9. 確認に使ったテスト案件は詳細画面から削除する
