import { IMPORT_COLUMNS } from '@/lib/cases/csvImport';
import { ImportClient } from './ImportClient';

export default function ImportPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">CSVで案件を一括登録</h1>
        <p className="text-sm text-mute mt-1">
          既存の案件をまとめて登録します。1行目は見出しで、「会社名」以外は省略できます。
          ツール（頭文字）・社内担当・段階は、設定に登録済みの名前と一致させてください。
        </p>
        <p className="text-xs text-mute mt-2">
          使える見出し: {IMPORT_COLUMNS.map((c) => c.header).join('、')}
        </p>
      </div>
      <ImportClient headers={IMPORT_COLUMNS.map((c) => c.header)} />
    </div>
  );
}
