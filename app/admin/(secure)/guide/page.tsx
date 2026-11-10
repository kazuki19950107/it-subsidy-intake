import Link from 'next/link';
import { ArrowDown, ArrowRight, Bot, Building2, CheckCircle2, FileText, MessageCircle, User, Users } from 'lucide-react';
import { getCaseOptions } from '@/lib/cases/queries';
import { getDocRules } from '@/lib/docRules/settings';
import { ALL_DOC_TYPES, ACCEPT_LABELS, FINANCIAL_SECTION_LABELS } from '@/lib/docRules/defaults';
import { ADMIN_PAGES } from '@/lib/admin/pages';
import { BILLING_TIMING_LABELS, MILESTONE_LABELS, MILESTONES, type Milestone } from '@/lib/cases/constants';
import { computeFee } from '@/lib/cases/fee';
import type { DocRule } from '@/lib/docRules/defaults';

// 使い方ページ。
// 段階・チェック項目・ツールとフィー・書類の判定・画面の一覧は、設定画面（DB）と lib/admin/pages.ts を
// そのまま読んで表示するので、設定や画面を変えるとこのページも自動で変わる。
// 文章の説明は手で書いているので、機能を変えたら該当する節も直すこと（CLAUDE.md 参照）。

export const dynamic = 'force-dynamic';
export const metadata = { title: '使い方 | 補助金 案件管理' };

const TOC = [
  { id: 'flow', label: '全体の流れ' },
  { id: 'screens', label: '画面の一覧' },
  { id: 'stages', label: '段階の進み方' },
  { id: 'register', label: '登録と同意書' },
  { id: 'documents', label: '書類の提出と判定' },
  { id: 'line', label: 'グループLINE' },
  { id: 'portal', label: 'ポータル同期' },
  { id: 'checks', label: 'チェック項目' },
  { id: 'fee', label: 'フィーと請求' },
  { id: 'daily', label: '毎日の使い方' },
  { id: 'trouble', label: 'こんなときは' },
];

type Who = 'staff' | 'customer' | 'auto';
const WHO: Record<Who, { label: string; cls: string; icon: typeof User }> = {
  staff: { label: '社内', cls: 'bg-ink text-white', icon: Users },
  customer: { label: '顧客', cls: 'bg-white text-ink border border-ink', icon: User },
  auto: { label: '自動', cls: 'bg-teal text-white', icon: Bot },
};

function WhoBadge({ who }: { who: Who }) {
  const w = WHO[who];
  const Icon = w.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${w.cls}`}>
      <Icon className="w-3 h-3" />
      {w.label}
    </span>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-md border border-rule p-5 space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {lead && <p className="text-sm text-mute mt-1">{lead}</p>}
      </div>
      <div className="text-sm text-charcoal leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-off-white border border-rule px-3 py-2 text-xs text-charcoal">{children}</div>;
}

function Live() {
  return (
    <span className="ml-2 align-middle text-[10px] font-semibold text-teal-dark bg-teal-light rounded px-1.5 py-0.5">
      設定の内容を表示中
    </span>
  );
}

function L({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-teal hover:underline font-semibold">
      {children}
    </Link>
  );
}

/** 横に並ぶ箱と矢印（狭い画面では縦） */
function FlowRow({ items }: { items: Array<{ title: string; sub?: string; who?: Who; tone?: string }> }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col md:flex-row items-center gap-2 md:flex-1 min-w-0">
          <div className={`w-full rounded-md border px-3 py-2 ${it.tone ?? 'border-rule bg-off-white'} md:h-full`}>
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-sm text-ink">{it.title}</span>
              {it.who && <WhoBadge who={it.who} />}
            </div>
            {it.sub && <div className="text-[11px] text-mute mt-0.5">{it.sub}</div>}
          </div>
          {i < items.length - 1 && (
            <>
              <ArrowRight className="hidden md:block w-4 h-4 text-mute shrink-0" />
              <ArrowDown className="md:hidden w-4 h-4 text-mute shrink-0" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const FLOW: Array<{ title: string; sub: string; who: Who }> = [
  { title: '案件を登録', sub: '会社情報を入れると同意書が自動で作られる', who: 'staff' },
  { title: '同意書に署名', sub: '専用URLで確認・署名・締結', who: 'customer' },
  { title: '書類を提出', sub: '専用フォーム。AIがその場で判定', who: 'customer' },
  { title: '社内に通知', sub: 'そろったら社内用グループへ', who: 'auto' },
  { title: 'グループLINE作成', sub: '公式LINEを招待→自動で紐付け', who: 'staff' },
  { title: 'ポータルで申請', sub: 'これまでどおり', who: 'staff' },
  { title: 'ポータル同期', sub: '毎朝6時。状態の変化を取り込む', who: 'auto' },
  { title: '採択・交付決定', sub: 'フィー計算・請求予定の作成', who: 'auto' },
  { title: '請求・入金', sub: '発行日・入金日を記録', who: 'staff' },
];

function feeLabel(t: { fee_method: 'rate' | 'fixed'; fee_rate: number | string | null; fee_fixed: number | null }) {
  return t.fee_method === 'rate'
    ? `補助金額 × ${Math.round(Number(t.fee_rate ?? 0) * 1000) / 10}%`
    : `定額 ${Number(t.fee_fixed ?? 0).toLocaleString()}円`;
}

function ruleText(r: DocRule): string {
  const p = r.params;
  const parts: string[] = [];
  if (r.doc_type === 'certificate_of_history' && p.max_age_days) parts.push(`発行から${p.max_age_days}日以内`);
  if (r.doc_type === 'id_document' && p.max_age_days) parts.push(`住民票は発行から${p.max_age_days}日以内`);
  if (r.doc_type === 'tax_cert_1' && p.certificate_type) parts.push(`「${p.certificate_type}」であること`);
  if (r.doc_type === 'financial_statements') {
    if (p.required_sections?.length) parts.push(`${p.required_sections.map((s) => FINANCIAL_SECTION_LABELS[s]).join('・')}がそろう`);
    if (p.max_period_age_days) parts.push(`決算期末から${p.max_period_age_days}日以内（直近期）`);
  }
  if (r.doc_type === 'tax_cert_2') parts.push('「その2」であること');
  if (r.doc_type === 'blue_form') parts.push('青色申告であること（白色は不可）');
  if (r.doc_type === 'tax_return') parts.push('受付印または電子申告の記録があること');
  return parts.join('、') || '—';
}

export default async function GuidePage() {
  const [options, rules] = await Promise.all([getCaseOptions(), getDocRules()]);
  const stages = options.stages;
  const tools = options.tools.filter((t) => t.active);
  const checkDefs = options.checkDefs.filter((d) => d.active);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const milestoneStage = (m: Milestone) => stages.find((s) => s.milestone === m)?.name ?? null;
  const notifyStages = stages.filter((s) => s.notify_customer);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">使い方</h1>
        <p className="text-sm text-mute mt-1">
          案件の登録から、同意書・書類提出・申請・採択・請求・入金までを、この画面でまとめて管理します。グループLINEを1つずつ開いて進捗を確認する必要はありません。
        </p>
        <p className="text-xs text-mute mt-1">
          <span className="font-semibold text-teal-dark bg-teal-light rounded px-1.5 py-0.5 mr-1">設定の内容を表示中</span>
          の付いた図表は、設定画面の今の内容をそのまま表示しています（設定を変えると、ここも変わります）。
        </p>
        <nav className="flex flex-wrap gap-2 mt-3 text-xs">
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="px-3 py-1 rounded-full border border-rule bg-white hover:bg-teal-light">
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      {/* ───────── 全体の流れ ───────── */}
      <Section id="flow" title="全体の流れ" lead="社内が手を動かすのは黒、顧客は白、自動は青のところです。">
        <div className="flex flex-wrap gap-2 text-xs">
          <WhoBadge who="staff" />
          <WhoBadge who="customer" />
          <WhoBadge who="auto" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {FLOW.map((f, i) => (
            <div key={f.title} className="relative rounded-md border border-rule bg-off-white p-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-light text-teal-dark text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-semibold text-ink">{f.title}</span>
              </div>
              <div className="text-[11px] text-mute mt-1">{f.sub}</div>
              <div className="mt-2">
                <WhoBadge who={f.who} />
              </div>
            </div>
          ))}
        </div>
        <Note>
          進捗のほとんどは「同意書の締結」「書類の提出」「ポータル同期」をきっかけに自動で記録され、段階が進みます。すべての変更は案件の詳細の「変更履歴」に、誰が（社内・顧客・ポータル・LINE）変えたかと一緒に残ります。
        </Note>
      </Section>

      {/* ───────── 画面の一覧 ───────── */}
      <Section id="screens" title="画面の一覧">
        <div className="grid gap-2 sm:grid-cols-2">
          {ADMIN_PAGES.filter((p) => p.href !== '/admin/guide').map((p) => {
            const Icon = p.icon;
            const body = (
              <>
                <Icon className="w-5 h-5 text-teal shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold text-ink">{p.label}</span>
                  <span className="block text-xs text-mute">{p.description}</span>
                </span>
              </>
            );
            return p.external ? (
              <a key={p.href} href={p.href} className="flex gap-3 rounded-md border border-rule p-3 hover:bg-teal-light/40">
                {body}
              </a>
            ) : (
              <Link key={p.href} href={p.href} className="flex gap-3 rounded-md border border-rule p-3 hover:bg-teal-light/40">
                {body}
              </Link>
            );
          })}
        </div>
      </Section>

      {/* ───────── 段階 ───────── */}
      <Section id="stages" title="段階の進み方" lead="段階は社内の進み具合です。自動で動くのは先の段階へだけで、戻ることはありません（手では自由に変えられます）。">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-mute">いまの段階</span>
          <Live />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="rounded px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: s.color }}>
                {s.name}
              </span>
              {i < stages.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-mute" />}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">段階</th>
                <th className="py-1.5 pr-3 font-normal">こうなったら自動で進む</th>
                <th className="py-1.5 pr-3 font-normal">ポータルの状態にこの語が出たら進む</th>
                <th className="py-1.5 font-normal">顧客へ通知</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              {stages.map((s) => (
                <tr key={s.id}>
                  <td className="py-1.5 pr-3">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </td>
                  <td className="py-1.5 pr-3">{s.milestone ? MILESTONE_LABELS[s.milestone] : <span className="text-mute">—</span>}</td>
                  <td className="py-1.5 pr-3">
                    {s.portal_keywords?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {s.portal_keywords.map((k) => (
                          <code key={k} className="bg-off-white border border-rule rounded px-1 text-xs">
                            {k}
                          </code>
                        ))}
                      </span>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                  </td>
                  <td className="py-1.5">{s.notify_customer ? <span className="text-ok font-semibold">送る</span> : <span className="text-mute">送らない</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          ポータル連動の語は「最も長く一致した語」を優先します（「不採択」は「採択」より優先）。段階の追加・名前・色・並び順・連動の語は <L href="/admin/settings#stages">設定</L> で変えられます。
        </Note>
      </Section>

      {/* ───────── 登録と同意書 ───────── */}
      <Section id="register" title="登録と同意書">
        <FlowRow
          items={[
            { title: '新規登録で会社情報を入力', sub: '会社名・法人番号・代表者・所在地・ツール・回次・担当', who: 'staff' },
            { title: '2つのURLを顧客に送る', sub: '申請URL（書類）と同意書の署名URL。期限なし', who: 'staff' },
            { title: '顧客が確認して署名', sub: '氏名入力か手書き', who: 'customer' },
            {
              title: '締結',
              sub: `PDF保存・SHA-256記録${milestoneStage('contract_signed') ? `・段階が「${milestoneStage('contract_signed')}」へ` : ''}`,
              who: 'auto',
              tone: 'border-teal bg-teal-light/40',
            },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-rule p-3">
            <div className="font-semibold text-ink mb-1">締結のときに記録するもの</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              <li>署名日時・IPアドレス・署名者の氏名／役職／メール</li>
              <li>締結済みPDF（非公開の保存場所）と、そのSHA-256</li>
              <li>同意書の文面の版</li>
            </ul>
          </div>
          <div className="rounded-md border border-rule p-3">
            <div className="font-semibold text-ink mb-1">会社情報を直したいとき</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              <li>署名前: 案件の情報を直し「今の情報で作り直す」→ 新しいURLを送り直す</li>
              <li>署名後: 作り直せません（締結済みの内容が正）</li>
            </ul>
          </div>
        </div>
        <Note>会社名と法人番号は、提出書類との照合にも使います。正しく入れておくと、別の会社の書類が出されたときに自動で不備になります。</Note>
      </Section>

      {/* ───────── 書類 ───────── */}
      <Section id="documents" title="書類の提出と判定" lead="顧客がアップロードした書類をAIが読み取り、下の条件で判定します。不備はその場で顧客に表示されます。">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-mute">判定の条件</span>
          <Live />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">書類</th>
                <th className="py-1.5 pr-3 font-normal text-center">法人</th>
                <th className="py-1.5 pr-3 font-normal text-center">個人事業主</th>
                <th className="py-1.5 pr-3 font-normal">条件</th>
                <th className="py-1.5 font-normal">形式</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              {ALL_DOC_TYPES.map((t) => {
                const r = rules[t];
                const mark = (on: boolean) =>
                  on ? <CheckCircle2 className="w-4 h-4 text-ok inline" aria-label="必須" /> : <span className="text-mute text-xs">任意</span>;
                return (
                  <tr key={t}>
                    <td className="py-1.5 pr-3">{r.label}</td>
                    <td className="py-1.5 pr-3 text-center">{mark(r.required_corporation)}</td>
                    <td className="py-1.5 pr-3 text-center">{mark(r.required_sole_proprietor)}</td>
                    <td className="py-1.5 pr-3 text-xs">{ruleText(r)}</td>
                    <td className="py-1.5 text-xs">{ACCEPT_LABELS[r.accept]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs font-semibold text-mute">お客様の入力と書類から、案件の情報に自動で入るもの</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">案件の情報</th>
                <th className="py-1.5 pr-3 font-normal">法人</th>
                <th className="py-1.5 font-normal">個人事業主</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50 text-xs">
              <tr>
                <td className="py-1.5 pr-3 text-sm">担当者名・電話・メール・会社名</td>
                <td className="py-1.5 pr-3" colSpan={2}>申請フォームの入力がそのまま入る（変更履歴に「申請フォーム」として残る）</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">会社名</td>
                <td className="py-1.5 pr-3">登記簿 → 納税証明書 → 決算書</td>
                <td className="py-1.5 text-mute">—</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">法人番号</td>
                <td className="py-1.5 pr-3">登記簿の会社法人等番号から計算</td>
                <td className="py-1.5 text-mute">—</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">回次</td>
                <td className="py-1.5 pr-3" colSpan={2}>ポータルと紐付いたときに「募集回」から（例: 8次 → 8）</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">補助金額</td>
                <td className="py-1.5 pr-3" colSpan={2}>ポータルの申請内容の「補助金申請額合計」から（毎朝の同期で、紐付いた案件だけ読む）</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">ツール</td>
                <td className="py-1.5 pr-3" colSpan={2}>ポータルの申請内容のITツール名が、設定の「ツール名」と一致したとき（ツール名は4文字以上で登録）</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">代表者</td>
                <td className="py-1.5 pr-3">登記簿 → 納税証明書</td>
                <td className="py-1.5">本人確認書類 → 確定申告書の氏名</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-sm">所在地</td>
                <td className="py-1.5 pr-3">登記簿の本店 → 納税証明書</td>
                <td className="py-1.5">本人確認書類 → 確定申告書の住所</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          書類やポータルから入れるのは<strong>空欄の項目だけ</strong>です。社内で入れた値は上書きせず、食い違っていれば書類の「不備」として表示します。自動で入った項目は変更履歴に「書類から自動入力」として残ります。
        </Note>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-rule p-3">
            <div className="font-semibold text-ink mb-1">どの書類にも行う判定</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              <li>写真なら、書類の四隅がすべて写っているか</li>
              <li>会社名・法人番号が登録した会社情報と一致するか</li>
            </ul>
          </div>
          <div className="rounded-md border border-warn/60 p-3">
            <div className="font-semibold text-ink mb-1">担当者確認が必要</div>
            <p className="text-xs">読み取りに自信がない書類は、案件の詳細の上部に表示されます。中身を目で確認してください。</p>
          </div>
          <div className="rounded-md border border-teal p-3">
            <div className="font-semibold text-ink mb-1">そろって送信されたら</div>
            <p className="text-xs">
              社内用グループに通知が届き{milestoneStage('documents_submitted') ? `、段階が「${milestoneStage('documents_submitted')}」に進みます` : 'ます'}。
            </p>
          </div>
        </div>
        <Note>
          必須かどうか・期限・納税証明書の種類・決算書にそろえる書類は <L href="/admin/settings#docs">設定の「書類の判定」</L> で変えられます。
        </Note>
      </Section>

      {/* ───────── LINE ───────── */}
      <Section id="line" title="グループLINE" lead="公式LINEは「顧客のグループ」と「社内用グループ」の2種類のグループに入ります。">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
          <div className="rounded-md border border-rule p-3">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Users className="w-4 h-4" />
              顧客のグループ
            </div>
            <div className="text-[11px] text-mute mt-1">顧客＋担当者＋公式LINE</div>
            <div className="text-xs mt-2">
              名前は <code className="bg-off-white px-1 rounded">3次BU×MEM株式会社様</code> の形で
            </div>
          </div>
          <div className="text-center text-[11px] text-mute">
            <ArrowRight className="hidden md:block w-5 h-5 mx-auto" />
            <ArrowDown className="md:hidden w-5 h-5 mx-auto" />
            招待・グループ名
          </div>
          <div className="rounded-md border-2 border-teal p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 font-semibold text-ink">
              <MessageCircle className="w-4 h-4 text-teal" />
              公式LINE ＋ このシステム
            </div>
            <div className="text-[11px] text-mute mt-1">グループ名から回次・ツール・会社名を読み取り、案件に紐付け</div>
          </div>
          <div className="text-center text-[11px] text-mute">
            <ArrowRight className="hidden md:block w-5 h-5 mx-auto" />
            <ArrowDown className="md:hidden w-5 h-5 mx-auto" />
            社内向けの通知
          </div>
          <div className="rounded-md border border-ink p-3">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Building2 className="w-4 h-4" />
              社内用グループ
            </div>
            <div className="text-[11px] text-mute mt-1">担当者＋公式LINEだけ</div>
            <div className="text-xs mt-2">
              <L href="/admin/line">LINE</L> で「社内用にする」
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">いつ</th>
                <th className="py-1.5 pr-3 font-normal">送り先</th>
                <th className="py-1.5 font-normal">通数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              <tr>
                <td className="py-1.5 pr-3">公式LINEをグループに招待したとき（あいさつ）</td>
                <td className="py-1.5 pr-3">そのグループ</td>
                <td className="py-1.5 text-ok">使わない</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">顧客が書類をそろえて送信したとき</td>
                <td className="py-1.5 pr-3">社内用グループ</td>
                <td className="py-1.5">1通×人数</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">ポータル同期で状態が変わった案件があったとき（毎朝まとめて1通）</td>
                <td className="py-1.5 pr-3">社内用グループ</td>
                <td className="py-1.5">1通×人数</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">ポータル同期に失敗したとき（すぐに）</td>
                <td className="py-1.5 pr-3">社内用グループ</td>
                <td className="py-1.5">1通×人数</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">
                  「顧客へ通知」がオンの段階に入ったとき
                  {notifyStages.length > 0 ? `（今は ${notifyStages.map((s) => s.name).join('・')}）` : '（今はどの段階もオフ）'}
                  <Live />
                </td>
                <td className="py-1.5 pr-3">顧客のグループ</td>
                <td className="py-1.5">1通×人数</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          公式LINEは無料プラン（月200通。送った回数×受け取る人数で数える）です。上限などで送れなかった通知は <L href="/admin/line">LINE</L> の「送れなかった通知」に残り、あとから再送できます。
          1件に絞れずに「未紐付け」になったグループは、同じ画面で候補から案件を選んでください。
        </Note>
      </Section>

      {/* ───────── ポータル ───────── */}
      <Section id="portal" title="ポータル同期" lead="申請はこれまでどおりポータルで行います。ポータルの状態は毎朝6時に自動で取り込みます（ポータル案件の画面から手動でも可能）。">
        <div className="text-xs font-semibold text-mute">ポータルの案件と、このシステムの案件の照合のしかた</div>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { step: '① 申請番号', hit: '一致 → そのまま紐付け', tone: 'border-teal bg-teal-light/40' },
            { step: '② 法人番号', hit: '一致 → 申請番号を自動で入れて紐付け', tone: 'border-teal bg-teal-light/40' },
            { step: '③ 会社名', hit: '似ている → 「候補」に出すだけ。人が選んで確定', tone: 'border-warn/60 bg-white' },
          ].map((x, i) => (
            <div key={x.step} className="flex md:flex-col items-center gap-2">
              <div className={`w-full rounded-md border p-3 ${x.tone}`}>
                <div className="font-semibold text-ink">{x.step}</div>
                <div className="text-xs mt-1">{x.hit}</div>
              </div>
              {i < 2 && <span className="text-[11px] text-mute shrink-0">見つからなければ次へ</span>}
            </div>
          ))}
        </div>
        <FlowRow
          items={[
            { title: '毎朝6時に取得', sub: 'ベンダーごとにログインして全件', who: 'auto' },
            { title: '前回と比べる', sub: '変わった案件だけ変更履歴に記録', who: 'auto' },
            { title: '段階を進める', sub: '段階の「ポータル連動」の語で判定', who: 'auto' },
            { title: '社内用グループに1通', sub: '変わった案件のまとめ', who: 'auto' },
          ]}
        />
        <Note>
          ポータルの「状態」は自動更新専用で、手で書き換えることはできません（次の同期で食い違うため）。紐付けは手でできます。案件の詳細のいちばん上にある「ポータル連携」で申請番号を入れるか、候補から選んでください。紐付けるとすぐに状態が入り、案件の回次が空欄ならポータルの募集回（例: 8次）も入ります。
        </Note>
      </Section>

      {/* ───────── チェック ───────── */}
      <Section id="checks" title="チェック項目" lead="段階と並行して進める作業です。案件の詳細でチェックを入れると完了になり、期限も変えられます。">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-mute">いまのチェック項目</span>
          <Live />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">項目</th>
                <th className="py-1.5 pr-3 font-normal">いつ追加されるか</th>
                <th className="py-1.5 font-normal">期限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              {checkDefs.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 pr-3">{d.name}</td>
                  <td className="py-1.5 pr-3 text-xs">
                    {d.system_key === 'invoice_issue'
                      ? '請求タイミングに達したとき（自動）'
                      : d.system_key === 'payment_received'
                        ? '請求書を発行したとき（自動）'
                        : d.stage_id
                          ? `「${stageName.get(d.stage_id) ?? '?'}」に入ったとき`
                          : '手で追加したとき'}
                  </td>
                  <td className="py-1.5 text-xs">{d.due_days != null ? `追加から${d.due_days}日` : 'なし'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          案件一覧で「チェック: 未完了の○○」を選ぶと、その作業が残っている案件だけを出せます。「並べ替え: 次の期限が近い順」で、期限切れ（赤字）から片付けられます。項目は <L href="/admin/settings#checks">設定</L> で追加できます。
        </Note>
      </Section>

      {/* ───────── フィー ───────── */}
      <Section id="fee" title="フィーと請求" lead="補助金額を入れておくと、節目に合わせてフィーが自動で計算され、請求予定が作られます。">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-mute">ツールごとの計算</span>
          <Live />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">ツール</th>
                <th className="py-1.5 pr-3 font-normal">計算方法</th>
                <th className="py-1.5 pr-3 font-normal">請求タイミング</th>
                <th className="py-1.5 font-normal text-right">例: 補助金 1,000,000円のとき</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              {tools.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 pr-3 font-semibold">
                    {t.code}
                    {t.name !== t.code && <span className="font-normal text-mute">（{t.name}）</span>}
                  </td>
                  <td className="py-1.5 pr-3">{feeLabel(t)}</td>
                  <td className="py-1.5 pr-3">{BILLING_TIMING_LABELS[t.billing_timing]}</td>
                  <td className="py-1.5 text-right tabular-nums">{(computeFee(t, 1_000_000) ?? 0).toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs font-semibold text-mute">節目ごとに起きること</div>
        <ol className="relative border-l-2 border-teal-light ml-2 space-y-3">
          {MILESTONES.map((m) => {
            const what: Partial<Record<Milestone, string>> = {
              adopted: 'フィー見込み額を計算',
              grant_decided: 'フィー確定額を計算',
            };
            const billingTools = tools.filter((t) => t.billing_timing === m).map((t) => t.code);
            const items = [
              what[m],
              billingTools.length ? `${billingTools.join('・')} の請求予定を作成し、チェック「請求書発行」を追加` : null,
              milestoneStage(m) ? `段階が「${milestoneStage(m)}」へ` : null,
            ].filter(Boolean);
            return (
              <li key={m} className="ml-4">
                <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-teal" />
                <div className="font-semibold text-ink">{MILESTONE_LABELS[m]}</div>
                <div className="text-xs text-charcoal">{items.length ? items.join(' ／ ') : <span className="text-mute">—</span>}</div>
              </li>
            );
          })}
        </ol>

        <FlowRow
          items={[
            { title: '請求予定ができる', sub: '売上・請求の画面に出る', who: 'auto' },
            { title: '請求書を発行', sub: '「今日発行した」を押す', who: 'staff' },
            { title: '「入金確認」が立つ', sub: '「請求書発行」は完了に', who: 'auto' },
            { title: '入金日を入れる', sub: '「入金確認」が完了に', who: 'staff', tone: 'border-teal bg-teal-light/40' },
          ]}
        />
        <Note>
          ポータルより先に採択などが分かったときは、案件の詳細の「節目の日付」に日付を入れて保存してください（段階も進みます）。補助金額を直すと、フィーと（請求書を発行する前なら）請求額も計算し直されます。
          <L href="/admin/billing">売上・請求</L> では、ツール別・回次別・月別の売上見込みを確認できます。
        </Note>
      </Section>

      {/* ───────── 毎日 ───────── */}
      <Section id="daily" title="毎日の使い方">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { time: '朝', what: '社内用グループの「ポータル同期」の通知で、状態が変わった案件を確認', href: '/admin/portal', link: 'ポータル案件' },
            { time: '朝', what: '期限が近い順に並べて、期限切れ（赤字）のチェック項目を片付ける', href: '/admin/dashboard?sort=due', link: '案件一覧（期限順）' },
            { time: '随時', what: '書類提出の通知が来たら、担当者確認が必要な書類と照合結果を見る', href: '/admin/dashboard?status=submitted', link: '送信済みの案件' },
            { time: '週1回', what: '「未紐付け」のグループと「送れなかった通知」がないか確認', href: '/admin/line', link: 'LINE' },
            { time: '請求のたび', what: '請求書発行日・入金日を記録する', href: '/admin/billing', link: '売上・請求' },
          ].map((x) => (
            <div key={x.what} className="flex gap-3 rounded-md border border-rule p-3">
              <span className="shrink-0 rounded bg-ink text-white text-[11px] font-semibold px-2 py-0.5 h-fit">{x.time}</span>
              <span className="text-sm">
                {x.what}
                <span className="block mt-1">
                  <L href={x.href}>{x.link} →</L>
                </span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────── トラブル ───────── */}
      <Section id="trouble" title="こんなときは">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1.5 pr-3 font-normal w-1/3">困っていること</th>
                <th className="py-1.5 font-normal">どうするか</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/50">
              {[
                ['グループLINEが案件に紐付かない', 'LINE の画面で、そのグループの「案件」から正しい案件を選ぶ。グループ名を直してから「自動で紐付け直す」でも可'],
                ['社内用グループに通知が来ない', 'LINE の画面の「送れなかった通知」で理由（月の上限・社内用グループ未登録など）を見て「再送」'],
                ['ポータルの状態が入らない', '案件の詳細のいちばん上にある「ポータル連携」で申請番号を入れる（または候補から選ぶ）。同期自体が失敗していないかはポータル案件の画面で確認'],
                ['段階が自動で進まない', '設定の段階で「こうなったら自動で進む」「ポータル連動の語」を確認。手で段階を変えてもよい'],
                ['書類が不備になるが内容は正しい', '案件の詳細の書類で読み取った値を確認。条件は設定の「書類の判定」で変えられる'],
                ['同意書の内容を直したい', '署名前なら案件の情報を直して「今の情報で作り直す」→ 新しいURLを送る。締結後は作り直せない'],
                ['既存の案件をまとめて入れたい', '案件一覧の右上「CSVで一括登録」からひな形をダウンロードして入力'],
              ].map(([q, a]) => (
                <tr key={q}>
                  <td className="py-2 pr-3 font-semibold align-top">
                    <FileText className="w-3.5 h-3.5 inline mr-1 text-mute" />
                    {q}
                  </td>
                  <td className="py-2 text-charcoal">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
