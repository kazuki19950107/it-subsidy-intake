import { normalizeCorporateNumber } from '@/lib/portal/match';
import { normalizeApplicationNo } from '@/lib/portal/normalize';

/** RFC 4180 形式の CSV を 2 次元配列にする（BOM・CRLF・ダブルクォート対応） */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** CSV の見出し → 案件の項目 */
export const IMPORT_COLUMNS = [
  { key: 'company_name', header: '会社名', required: true },
  { key: 'corporate_number', header: '法人番号' },
  { key: 'representative_name', header: '代表者' },
  { key: 'address', header: '所在地' },
  { key: 'applicant_name', header: '担当者名' },
  { key: 'phone', header: '電話番号' },
  { key: 'email', header: 'メールアドレス' },
  { key: 'tool_code', header: 'ツール' },
  { key: 'round', header: '回次' },
  { key: 'staff_name', header: '社内担当' },
  { key: 'referrer', header: '紹介元' },
  { key: 'portal_application_no', header: '申請番号' },
  { key: 'subsidy_amount', header: '補助金額' },
  { key: 'stage_name', header: '段階' },
  { key: 'applicant_type', header: '区分' },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]['key'];

export type ImportRow = {
  line: number;
  company_name: string;
  corporate_number: string | null;
  representative_name: string | null;
  address: string | null;
  applicant_name: string | null;
  phone: string | null;
  email: string | null;
  tool_code: string | null;
  round: number | null;
  staff_name: string | null;
  referrer: string | null;
  portal_application_no: string | null;
  subsidy_amount: number | null;
  stage_name: string | null;
  applicant_type: 'corporation' | 'sole_proprietor';
};

export type ImportParseResult = {
  rows: ImportRow[];
  errors: Array<{ line: number; message: string }>;
  unknownHeaders: string[];
};

function toInt(v: string): number | null {
  const t = v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,円\s次]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/** CSV テキストを取り込み用の行にする。1 行目は見出し */
export function parseImportCsv(text: string): ImportParseResult {
  const table = parseCsv(text);
  const errors: ImportParseResult['errors'] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'CSV が空です' }], unknownHeaders: [] };

  const headers = table[0].map((h) => h.trim());
  const index = new Map<ImportKey, number>();
  const unknownHeaders: string[] = [];
  headers.forEach((h, i) => {
    const col = IMPORT_COLUMNS.find((c) => c.header === h || c.key === h);
    if (col) index.set(col.key, i);
    else if (h) unknownHeaders.push(h);
  });
  if (!index.has('company_name')) {
    return { rows: [], errors: [{ line: 1, message: '見出しに「会社名」がありません' }], unknownHeaders };
  }

  const rows: ImportRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const line = r + 1;
    const cell = (k: ImportKey) => {
      const i = index.get(k);
      const v = i == null ? '' : (table[r][i] ?? '');
      return v.trim();
    };
    const opt = (k: ImportKey) => cell(k) || null;
    const company = cell('company_name');
    if (!company) {
      errors.push({ line, message: '会社名が空です' });
      continue;
    }
    const corpRaw = cell('corporate_number');
    const corp = corpRaw ? normalizeCorporateNumber(corpRaw) : null;
    if (corpRaw && !corp) errors.push({ line, message: `法人番号が 13 桁ではありません（${corpRaw}）` });
    const round = cell('round') ? toInt(cell('round')) : null;
    if (round != null && Number.isNaN(round)) errors.push({ line, message: `回次が数字ではありません（${cell('round')}）` });
    const amount = cell('subsidy_amount') ? toInt(cell('subsidy_amount')) : null;
    if (amount != null && Number.isNaN(amount)) errors.push({ line, message: `補助金額が数字ではありません（${cell('subsidy_amount')}）` });
    const typeRaw = cell('applicant_type');
    const applicant_type = /個人/.test(typeRaw) ? 'sole_proprietor' : 'corporation';

    rows.push({
      line,
      company_name: company,
      corporate_number: corp,
      representative_name: opt('representative_name'),
      address: opt('address'),
      applicant_name: opt('applicant_name'),
      phone: opt('phone'),
      email: opt('email'),
      tool_code: cell('tool_code') ? cell('tool_code').toUpperCase() : null,
      round: round != null && !Number.isNaN(round) ? round : null,
      staff_name: opt('staff_name'),
      referrer: opt('referrer'),
      portal_application_no: normalizeApplicationNo(cell('portal_application_no')),
      subsidy_amount: amount != null && !Number.isNaN(amount) ? amount : null,
      stage_name: opt('stage_name'),
      applicant_type,
    });
  }
  return { rows, errors, unknownHeaders };
}

/** 取り込み用 CSV のひな形（見出しのみ） */
export function importTemplateCsv(): string {
  return IMPORT_COLUMNS.map((c) => c.header).join(',') + '\n';
}
