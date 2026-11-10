import { MasterTable, type FieldDef } from '@/components/admin/MasterTable';
import { getCaseOptions } from '@/lib/cases/queries';
import { getDocRules } from '@/lib/docRules/settings';
import { BILLING_TIMINGS, BILLING_TIMING_LABELS, MILESTONES, MILESTONE_LABELS } from '@/lib/cases/constants';
import { DocRulesEditor } from './DocRulesEditor';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { id: 'stages', label: '段階' },
  { id: 'checks', label: 'チェック項目' },
  { id: 'tools', label: 'ツールとフィー' },
  { id: 'accounts', label: '社内担当' },
  { id: 'docs', label: '書類の判定' },
];

export default async function SettingsPage() {
  const [options, rules] = await Promise.all([getCaseOptions(), getDocRules()]);
  const stageOptions = options.stages.map((s) => ({ value: s.id, label: s.name }));

  const stageFields: FieldDef[] = [
    { key: 'name', label: '名前', type: 'text', width: '120px' },
    { key: 'color', label: '色', type: 'color' },
    {
      key: 'milestone',
      label: '節目',
      type: 'select',
      nullable: true,
      width: '130px',
      options: MILESTONES.map((m) => ({ value: m, label: MILESTONE_LABELS[m] })),
    },
    { key: 'portal_keywords', label: 'ポータル連動（この語を含む状態で進める）', type: 'tags', width: '200px', placeholder: '例: 採択、交付決定' },
    { key: 'notify_customer', label: '顧客に通知', type: 'checkbox' },
    { key: 'customer_message', label: '顧客向け定型文（{会社名} {段階} が使えます）', type: 'textarea', width: '240px' },
  ];
  const checkFields: FieldDef[] = [
    { key: 'name', label: '名前', type: 'text', width: '140px' },
    { key: 'stage_id', label: '自動で追加する段階', type: 'select', nullable: true, options: stageOptions, width: '140px' },
    { key: 'due_days', label: '期限（日数）', type: 'number', width: '80px' },
    { key: 'active', label: '有効', type: 'checkbox' },
  ];
  const toolFields: FieldDef[] = [
    { key: 'code', label: '頭文字', type: 'text', width: '70px' },
    { key: 'name', label: 'ツール名', type: 'text', width: '140px' },
    {
      key: 'fee_method',
      label: '計算方法',
      type: 'select',
      options: [
        { value: 'rate', label: '補助金額×率' },
        { value: 'fixed', label: '定額' },
      ],
    },
    { key: 'fee_rate', label: '率（%）', type: 'number', step: 0.1, scale: 100, width: '80px' },
    { key: 'fee_fixed', label: '定額（円）', type: 'number', width: '110px' },
    {
      key: 'billing_timing',
      label: '請求タイミング',
      type: 'select',
      options: BILLING_TIMINGS.map((t) => ({ value: t, label: BILLING_TIMING_LABELS[t] })),
    },
    { key: 'active', label: '有効', type: 'checkbox' },
  ];
  const accountFields: FieldDef[] = [
    { key: 'name', label: '氏名', type: 'text', width: '140px' },
    { key: 'email', label: 'メール', type: 'text', width: '180px' },
    { key: 'memo', label: 'メモ', type: 'text', width: '180px' },
    { key: 'active', label: '有効', type: 'checkbox' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">設定</h1>
        <p className="text-sm text-mute">段階・チェック項目・ツール・社内担当・書類の判定を変えられます。</p>
        <nav className="flex flex-wrap gap-2 mt-3 text-sm">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="px-3 py-1 rounded-full border border-rule bg-white hover:bg-teal-light">
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <div id="stages">
        <MasterTable
          key={JSON.stringify(options.stages)}
          resource="stages"
          title="段階"
          description={
            '案件の社内の段階です。上から順に進みます（自動で動かすのは先の段階へだけ）。\n' +
            '「節目」: この段階に入ると節目の日付が入り、逆に節目に達するとこの段階へ進みます（フィー・請求の基準）。\n' +
            '「ポータル連動」: ポータルの状態に語が含まれていたら、この段階へ進めます（最も長く一致した語を優先）。\n' +
            '「顧客に通知」をオンにすると、この段階に入ったときに顧客のグループLINEへ定型文を送ります（通数を使います）。'
          }
          fields={stageFields}
          rows={options.stages as unknown as Array<Record<string, unknown> & { id: string }>}
          newDefaults={{ color: '#6b6b6b', notify_customer: false }}
        />
      </div>

      <div id="checks">
        <MasterTable
          key={JSON.stringify(options.checkDefs)}
          resource="check_item_defs"
          title="チェック項目"
          description={
            '請求・契約・入金などを段階と並行して管理する項目です。「自動で追加する段階」に入った案件に追加され、期限は追加日からの日数です。\n' +
            '「請求書発行」「入金確認」はシステムが使うため削除できません（無効にはできます）。'
          }
          fields={checkFields}
          rows={options.checkDefs as unknown as Array<Record<string, unknown> & { id: string }>}
          newDefaults={{ active: true }}
        />
      </div>

      <div id="tools">
        <MasterTable
          key={JSON.stringify(options.tools)}
          resource="tools"
          title="ツールとフィー"
          description="採択の時点で見込み額、交付決定の時点で確定額を計算します。請求タイミングに達すると請求予定が作られます。"
          fields={toolFields}
          rows={options.tools as unknown as Array<Record<string, unknown> & { id: string }>}
          newDefaults={{ fee_method: 'rate', billing_timing: 'subsidy_paid', active: true }}
        />
      </div>

      <div id="accounts">
        <MasterTable
          key={JSON.stringify(options.accounts)}
          resource="accounts"
          title="社内担当"
          description="案件の担当者として選ぶ人の一覧です（ログインには使いません）。"
          fields={accountFields}
          rows={options.accounts as unknown as Array<Record<string, unknown> & { id: string }>}
          newDefaults={{ active: true }}
        />
      </div>

      <div id="docs">
        <DocRulesEditor rules={rules} />
      </div>
    </div>
  );
}
