'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit2, Save, X } from 'lucide-react';
import type { DocType } from '@/lib/supabase/types';

type Props = {
  documentId: string;
  docType: DocType;
  ocrResult: Record<string, unknown>;
  onSave: (corrected: Record<string, unknown>) => void;
};

const FIELD_LABELS: Record<string, string> = {
  company_number: '会社法人等番号',
  company_name: '会社名',
  head_office_address: '本店所在地',
  incorporation_date: '法人成立年月日',
  representative_name: '代表者氏名',
  capital: '資本金',
  issued_date: '発行日',
  purpose: '事業目的',
  certificate_type: '証明書種類',
  tax_category: '税目',
  taxpayer_address: '納税者住所',
  taxpayer_name: '納税者氏名',
  representative: '代表者',
  fiscal_year_from: '事業年度 開始',
  fiscal_year_to: '事業年度 終了',
  tax_due: '納付すべき税額',
  tax_paid: '納付済額',
  tax_unpaid: '未納額',
  issuer: '発行者',
  certificate_no: '証明書番号',
  tax_year: '対象年度',
  income_declared: '申告所得金額',
  income_corrected: '更正後所得金額',
  document_types_detected: '検出された書類種別',
  fiscal_period_from: '会計期間 開始',
  fiscal_period_to: '会計期間 終了',
  net_sales: '売上高',
  gross_profit: '売上総利益',
  operating_profit: '営業利益',
  total_assets: '資産合計',
  total_liabilities: '負債合計',
  net_assets: '純資産合計',
  doc_type: '書類種別',
  full_name: '氏名',
  full_name_kana: 'フリガナ',
  address: '住所',
  birth_date: '生年月日',
  expiration_date: '有効期限',
  license_no: '免許証番号',
  municipality: '発行市区町村',
  has_front: '表面あり',
  has_back: '裏面あり',
  filer_name: '申告者氏名',
  filer_address: '申告者住所',
  business_income: '事業所得金額',
  total_income: '所得合計',
  e_tax_timestamp: 'e-Tax 受付日時',
  e_tax_receipt_no: 'e-Tax 受付番号',
  office_stamp_detected: '受付印検出',
  filing_type: '申告区分',
  sales_amount: '売上金額',
  net_before_deduction: '控除前所得金額',
  depreciation: '減価償却費',
  blue_deduction: '青色申告特別控除額',
  net_income: '所得金額',
  receipt_datetime: '受付日時',
  receipt_no: '受付番号',
  submitter_name: '提出者',
  procedure_name: '手続き名',
};

export function ExtractionPreview({ documentId, ocrResult, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(ocrResult);
  const [saving, setSaving] = useState(false);

  const displayKeys = Object.keys(values).filter((k) => !k.startsWith('_'));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_corrected: values }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      onSave(values);
      setEditing(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValues(ocrResult);
    setEditing(false);
  };

  return (
    <div className="mt-3 p-3 bg-white rounded-md border border-rule">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-charcoal">抽出結果</h4>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="w-3 h-3" />
            修正
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-3 h-3" />
              キャンセル
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3" />
              {saving ? '保存中' : '保存'}
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {displayKeys.map((key) => {
          const raw = values[key];
          const label = FIELD_LABELS[key] ?? key;
          if (typeof raw === 'boolean') {
            return (
              <div key={key} className="flex items-center justify-between border-b border-rule/50 py-1.5">
                <dt className="text-mute">{label}</dt>
                <dd className="font-medium">{raw ? 'はい' : 'いいえ'}</dd>
              </div>
            );
          }
          if (Array.isArray(raw)) {
            return (
              <div key={key} className="flex items-start justify-between border-b border-rule/50 py-1.5">
                <dt className="text-mute">{label}</dt>
                <dd className="font-medium text-right">{raw.join(', ')}</dd>
              </div>
            );
          }
          return (
            <div key={key} className="flex flex-col gap-1 border-b border-rule/50 py-1.5">
              <dt className="text-xs text-mute">{label}</dt>
              <dd>
                {editing ? (
                  <Input
                    value={raw == null ? '' : String(raw)}
                    onChange={(e) => {
                      const v = e.target.value;
                      const isNum = typeof raw === 'number';
                      setValues({
                        ...values,
                        [key]: v === '' ? null : isNum ? Number(v) : v,
                      });
                    }}
                    className="h-8 text-sm"
                  />
                ) : (
                  <span className="font-medium">
                    {raw == null || raw === '' ? (
                      <span className="text-mute">未取得</span>
                    ) : (
                      String(raw)
                    )}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
