# プロンプト集

各書類の実際のプロンプトは `lib/claude/extractors/*.ts` の `SYSTEM_PROMPT` / `USER_PROMPT` に定義されています。このフォルダはプロンプト改善時のドキュメント・実験用として使います。

## 書類一覧

| 書類 | 実装 |
|---|---|
| 履歴事項全部証明書 | `lib/claude/extractors/certificateOfHistory.ts` |
| 納税証明書その1（法人税） | `lib/claude/extractors/taxCertificate1.ts` |
| 納税証明書その2（所得税） | `lib/claude/extractors/taxCertificate2.ts` |
| 決算書（P/L・販管費・B/S） | `lib/claude/extractors/financialStatements.ts` |
| 本人確認書類 | `lib/claude/extractors/idDocument.ts` |
| 確定申告書 第一表 | `lib/claude/extractors/taxReturn.ts` |
| 青色申告決算書 | `lib/claude/extractors/blueForm.ts` |
| 電子申告受信通知 | `lib/claude/extractors/eTaxReceipt.ts` |

## 共通ルール

`lib/claude/prompts.ts` の `GENERIC_INSTRUCTIONS` を参照。
