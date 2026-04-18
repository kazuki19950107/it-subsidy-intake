# サンプル画像配置

以下の8種類の書類画像を配置してください（個人情報はマスキング済みのもの）。extractor 単体テストで参照します。

| ファイル名 | 書類 |
|---|---|
| `certificate_of_history.jpg` | 履歴事項全部証明書 |
| `tax_cert_1_corporate.jpg` | 納税証明書その1（法人税） |
| `tax_cert_1_consumption.jpg` | 納税証明書その1（消費税／エラーケース） |
| `financial_statements.jpg` | 決算書（PL/販管費/BS のいずれか） |
| `drivers_license.jpg` | 運転免許証 |
| `tax_cert_2.jpg` | 納税証明書その2（所得税） |
| `tax_return.jpg` | 確定申告書第一表 |
| `blue_form.jpg` | 青色申告決算書 |

## 使い方

`__tests__/extractors/*.test.ts` で `sample-documents/` 内の画像を `fs.readFileSync` で読み込み、Claude API の実通信テストを実施します。

## 注意

- このフォルダ内の画像は `.gitignore` で Git 管理対象外としています（`README.md` のみコミット）
- テスト実行時は `ANTHROPIC_API_KEY` を `.env.test` などに設定してください
