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
