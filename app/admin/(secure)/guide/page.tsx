import Link from 'next/link';
import { ArrowDown, ArrowRight, Bot, Building2, CheckCircle2, ChevronDown, FileText, MessageCircle, User, Users } from 'lucide-react';
import { getCaseOptions } from '@/lib/cases/queries';
import { getDocRules } from '@/lib/docRules/settings';
import { ALL_DOC_TYPES, ACCEPT_LABELS, FINANCIAL_SECTION_LABELS } from '@/lib/docRules/defaults';
import { ADMIN_PAGES } from '@/lib/admin/pages';
import { getInvoiceSettings } from '@/lib/billing/invoiceService';
import { missingSettings } from '@/lib/billing/invoice';
import { BILLING_TIMING_LABELS, MILESTONE_LABELS, MILESTONES, type Milestone } from '@/lib/cases/constants';
import { computeFee } from '@/lib/cases/fee';
import type { DocRule } from '@/lib/docRules/defaults';

// 使い方ページ。案件の進み方に合わせて「フェーズ」ごとに分け、各フェーズは「やること」だけを見せる。
// 細かい条件や表は「くわしく」（折りたたみ）や「参考」に入れる。
// 段階・チェック項目・ツールとフィー・書類の判定・請求書の設定・画面の一覧は、設定画面（DB）と lib/admin/pages.ts を
// そのまま読んで表示するので、設定や画面を変えるとこのページも自動で変わる。
// 文章の説明は手で書いているので、機能を変えたら該当するフェーズも直すこと（CLAUDE.md 参照）。

export const dynamic = 'force-dynamic';
export const metadata = { title: '使い方' };

type Who = 'staff' | 'customer' | 'auto';
const WHO: Record<Who, { label: string; cls: string; icon: typeof User }> = {
  staff: { label: '社内', cls: 'bg-ink text-white', icon: Users },
  customer: { label: '顧客', cls: 'bg-white text-ink border border-ink', icon: User },
  auto: { label: '自動', cls: 'bg-sky-50 text-sky-700 border border-sky-200', icon: Bot },
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

/** フェーズの一覧（上の地図と各節の見出しで使う） */
const PHASES = [
  { id: 'phase0', no: 0, title: 'はじめの準備', when: '最初に1回だけ', sub: '設定・ベンダー・社内用LINE' },
  { id: 'phase1', no: 1, title: '受付〜同意書', when: '新しいお客様が来たら', sub: '案件登録・同意書の署名・グループLINE' },
  { id: 'phase2', no: 2, title: '書類の回収', when: '同意書のあと', sub: '書類提出フォーム・AIの判定・確認' },
  { id: 'phase3', no: 3, title: '申請〜採択', when: '書類がそろったら', sub: 'ポータルで申請・毎朝の同期' },
  { id: 'phase4', no: 4, title: '採択後の契約・請求', when: '採択されたら', sub: 'ベンダー → お客様の契約書・請求書' },
  { id: 'phase5', no: 5, title: '交付決定〜入金', when: '交付決定・補助金の入金', sub: 'フィーの確定・ベンダーへの請求・入金' },
] as const;

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

/** フェーズの節。番号・いつ・やることの流れ・使う画面 */
function Phase({
  no,
  lead,
  pages,
  children,
}: {
  no: number;
  lead: string;
  pages: Array<{ href: string; label: string }>;
  children: React.ReactNode;
}) {
  const p = PHASES[no];
  return (
    <section id={p.id} className="bg-white rounded-md border border-rule p-5 space-y-4 scroll-mt-20">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-full bg-ink text-white text-base font-bold flex items-center justify-center">{p.no}</span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-mute">
            フェーズ{p.no}・{p.when}
          </div>
          <h2 className="text-lg font-bold text-ink leading-tight">{p.title}</h2>
          <p className="text-sm text-mute mt-1">{lead}</p>
        </div>
      </div>
      <div className="text-sm text-charcoal leading-relaxed space-y-4">{children}</div>
      {pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-t border-rule pt-3">
          <span className="text-mute">使う画面:</span>
          {pages.map((x) => (
            <Link key={x.href} href={x.href} className="rounded-full border border-rule px-2.5 py-0.5 hover:bg-teal-light font-semibold text-ink">
              {x.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** 「くわしく」: ふだんは閉じておく説明 */
function More({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-rule">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-ink hover:bg-off-white [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="w-4 h-4 text-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-3 text-sm text-charcoal">{children}</div>
    </details>
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

const DONE = 'border-teal bg-teal-light/40';

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
  const [options, rules, invoiceSettings] = await Promise.all([getCaseOptions(), getDocRules(), getInvoiceSettings()]);
  const invoiceMissing = missingSettings(invoiceSettings);
  const stages = options.stages;
  const tools = options.tools.filter((t) => t.active);
  const checkDefs = options.checkDefs.filter((d) => d.active);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const milestoneStage = (m: Milestone) => stages.find((s) => s.milestone === m)?.name ?? null;
  const notifyStages = stages.filter((s) => s.notify_customer);
  const toStage = (m: Milestone) => (milestoneStage(m) ? `段階が「${milestoneStage(m)}」へ` : '');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">使い方</h1>
        <p className="text-sm text-mute mt-1">
          案件は下の6つのフェーズの順に進みます。いまの案件がどのフェーズかを見て、そのフェーズの「やること」だけ読めば大丈夫です。
        </p>
      </div>

      {/* ───────── 全体の地図 ───────── */}
      <section id="map" className="bg-white rounded-md border border-rule p-5 space-y-3 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">全体の流れ</h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <WhoBadge who="staff" />
            <WhoBadge who="customer" />
            <WhoBadge who="auto" />
          </div>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`} className="flex h-full gap-3 rounded-md border border-rule p-3 hover:bg-teal-light/40">
                <span
                  className={`shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${p.no === 0 ? 'bg-off-white text-ink border border-rule' : 'bg-ink text-white'}`}
                >
                  {p.no}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-mute">{p.when}</span>
                  <span className="block font-semibold text-ink">{p.title}</span>
                  <span className="block text-xs text-mute">{p.sub}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <div className="rounded-md bg-ink text-white px-4 py-3 text-sm">
          <span className="font-bold">迷ったら「次にやること」を見てください。</span>
          案件の詳細のいちばん上に、今のフェーズ（①〜⑤）と次の一手が1つだけ出ます。ボタンを押すと、その作業をする場所へ飛びます。案件一覧の「次にやること」の列でも見られます。
        </div>
        <p className="text-xs text-mute">
          進み具合（段階）は、同意書の締結・書類の提出・ポータルの状態をきっかけに自動で進みます。すべての変更は案件の詳細の「変更履歴」に、誰が変えたかと一緒に残ります。
          <span className="font-semibold text-teal-dark bg-teal-light rounded px-1.5 py-0.5 mx-1">設定の内容を表示中</span>
          の付いた表は、設定画面の今の内容です。
        </p>
      </section>

      {/* ───────── 動画 ───────── */}
      <More title="動画で見る（約7分・押すと開きます）">
        <video
          className="w-full rounded-lg border border-rule bg-black"
          src="/guide/tsumugi-guide.mp4"
          poster="/guide/tsumugi-guide-poster.png"
          controls
          preload="metadata"
          playsInline
        >
          お使いのブラウザでは動画を再生できません。
        </video>
        <div className="flex flex-wrap gap-3 text-xs">
          <a href="/guide/tsumugi-guide.mp4" download className="text-teal hover:underline font-semibold">
            動画をダウンロード（mp4）
          </a>
          <span className="text-mute">押す場所を枠で示しながら、音声と字幕でフェーズの順に説明します。LINE などでそのまま共有できます。</span>
        </div>
      </More>

      {/* ───────── フェーズ0 ───────── */}
      <Phase
        no={0}
        lead="使い始める前に1回だけ行います。あとから変えることもできます。"
        pages={[
          { href: '/admin/settings', label: '設定' },
          { href: '/admin/vendors', label: 'ベンダー' },
          { href: '/admin/line', label: 'LINE' },
        ]}
      >
        <ol className="space-y-2">
          {[
            {
              t: 'ツールとフィー・社内担当を確認する',
              d: (
                <>
                  <L href="/admin/settings#tools">設定</L> のツール（例: BU・LU）ごとに、フィーの計算（補助金額×率 か 定額）と請求のタイミングを入れます。社内担当も登録します。
                </>
              ),
            },
            {
              t: '自社の請求書の情報を入れる',
              d: (
                <>
                  <L href="/admin/settings#invoice">設定の「請求書」</L> に、会社名・住所・インボイスの登録番号・振込先を入れます（フェーズ5でベンダーへ出すフィーの請求書に載ります）。
                  {invoiceMissing.length > 0 && <span className="text-accent">（まだ入っていない項目: {invoiceMissing.join('・')}）</span>}
                </>
              ),
            },
            {
              t: 'ベンダーを登録する',
              d: (
                <>
                  <L href="/admin/vendors">ベンダー</L> で、ポータルのログインID・パスワード（毎朝の同期に使う）と、「請求書・契約書」（フェーズ4でベンダーからお客様へ出す書類の会社名・住所・登録番号・振込先・契約書の文面）を入れます。ベンダーごとに違ってよいです。
                </>
              ),
            },
            {
              t: '社内用のLINEグループを作る',
              d: (
                <>
                  LINEアプリで社内の担当者だけのグループを作り、公式LINEを招待します。<L href="/admin/line">LINE</L> の画面でそのグループの「社内用にする」を押すと、社内向けの通知がここに届きます。
                </>
              ),
            },
          ].map((x, i) => (
            <li key={x.t} className="flex gap-3 rounded-md border border-rule p-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-off-white border border-rule text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>
                <span className="block font-semibold text-ink">{x.t}</span>
                <span className="block text-xs mt-0.5">{x.d}</span>
              </span>
            </li>
          ))}
        </ol>
        <More title="くわしく: ツールごとのフィーの計算">
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
        </More>
        <More title="くわしく: LINE の設定（LINE Developers）">
          <p className="text-xs">
            LINE Developers の Messaging API 設定で、Webhook URL（<L href="/admin/line">LINE</L> の画面に表示）を登録し、「Webhookの利用」と「グループ・複数人トークへの参加を許可する」をオンにします。LINE Official Account Manager の「応答メッセージ」はオフにしてください（オンのままだと、グループで発言するたびに自動の返事が出ます）。
          </p>
        </More>
      </Phase>

      {/* ───────── フェーズ1 ───────── */}
      <Phase
        no={1}
        lead="案件を登録して同意書に署名してもらい、お客様とのグループLINEを作ります。"
        pages={[
          { href: '/admin/dashboard/new', label: '新規登録' },
          { href: '/admin/dashboard', label: '案件一覧' },
          { href: '/admin/line', label: 'LINE' },
        ]}
      >
        <FlowRow
          items={[
            { title: '案件を登録', sub: '会社名・代表者・所在地・ツール・回次・ベンダー（同意書の宛名）', who: 'staff' },
            { title: 'URLを2つ送る', sub: '同意書の署名URLと、書類の申請URL（期限なし）', who: 'staff' },
            { title: '同意書に署名', sub: '住所・名称・代表者を入れて、氏名入力か手書きで署名', who: 'customer' },
            { title: '締結', sub: `PDFを保存${toStage('contract_signed') ? `・${toStage('contract_signed')}` : ''}`, who: 'auto', tone: DONE },
          ]}
        />
        <div className="rounded-md border border-rule p-3 space-y-2">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            お客様とのグループLINEを作る
          </div>
          <p className="text-xs">
            LINEアプリでお客様とのグループを作り、名前を <code className="bg-off-white px-1 rounded">3次BU×MEM株式会社様</code>（回次・ツール・会社名）の形にしてから公式LINEを招待します。グループ名を読み取って、案件に自動で紐付きます。
          </p>
          <p className="text-xs text-mute">
            同じ会社名の案件が複数あるなどで1件に絞れないときは「未紐付け」になります。<L href="/admin/line">LINE</L> の画面で、そのグループの「案件」から正しい案件を選んでください。
          </p>
        </div>
        <More title="くわしく: 同意書で記録するもの・直したいとき">
          <ul className="text-xs space-y-0.5 list-disc pl-4">
            <li>締結のとき: 署名日時・IPアドレス・署名者の氏名／役職／メール、締結済みPDFとそのSHA-256、文面の版を記録します。</li>
            <li>同意書の宛名（「○○ 御中」）は案件のベンダーの名前です。ベンダーが未設定だと同意書は作れません。</li>
            <li>同意書の最後の「住所・名称・代表者」は、お客様が署名のときに入れます（案件に入っている値は最初から入っています）。入れた値は、案件の空欄にも入ります。</li>
            <li>署名前に会社情報やベンダーを直したいとき: 案件の情報を直して「今の情報で作り直す」→ 新しいURLを送り直します。</li>
            <li>署名後は作り直せません（締結済みの内容が正です）。</li>
            <li>会社名と法人番号は提出書類との照合にも使います。正しく入れておくと、別の会社の書類が出されたときに自動で不備になります。</li>
          </ul>
        </More>
      </Phase>

      {/* ───────── フェーズ2 ───────── */}
      <Phase
        no={2}
        lead="お客様が申請URLから書類を出し、AIがその場で読み取って判定します。社内は通知を受けて確認するだけです。"
        pages={[
          { href: '/admin/dashboard?status=submitted', label: '送信済みの案件' },
          { href: '/admin/talk', label: 'トーク' },
        ]}
      >
        <FlowRow
          items={[
            { title: '書類を出す', sub: '申請URLから。不備はその場で表示', who: 'customer' },
            { title: 'AIが読み取り・判定', sub: '会社名・法人番号との照合も', who: 'auto' },
            { title: '社内に通知', sub: `社内用グループへ${toStage('documents_submitted') ? `・${toStage('documents_submitted')}` : ''}`, who: 'auto' },
            { title: '確認する', sub: '「担当者確認が必要」な書類だけ目で見る', who: 'staff', tone: DONE },
          ]}
        />
        <Note>
          書類やポータルから案件の情報（会社名・法人番号・代表者・所在地など）に入れるのは<strong>空欄の項目だけ</strong>です。社内で入れた値は上書きせず、食い違えば書類の「不備」として表示します。
        </Note>
        <More title="くわしく: 書類ごとの判定の条件">
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
          <ul className="text-xs space-y-0.5 list-disc pl-4">
            <li>どの書類も: 写真なら四隅がすべて写っているか、会社名・法人番号が登録した会社情報と一致するかを見ます。</li>
            <li>読み取りに自信がない書類は「担当者確認が必要」として、案件の詳細の上部に出ます。</li>
            <li>
              必須かどうか・期限・納税証明書の種類・決算書にそろえる書類は <L href="/admin/settings#docs">設定の「書類の判定」</L> で変えられます。
            </li>
          </ul>
        </More>
        <More title="くわしく: 書類から案件の情報に自動で入るもの">
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
                  <td className="py-1.5 pr-3" colSpan={2}>申請フォームの入力がそのまま入る</td>
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
        </More>
      </Phase>

      {/* ───────── フェーズ3 ───────── */}
      <Phase
        no={3}
        lead="申請はこれまでどおりポータルで行います。案件をポータルと紐付けておけば、あとは毎朝6時に状態を取り込み、段階も自動で進みます。"
        pages={[
          { href: '/admin/portal', label: 'ポータル案件' },
          { href: '/admin/dashboard', label: '案件一覧' },
        ]}
      >
        <FlowRow
          items={[
            { title: 'ポータルで申請', sub: 'これまでどおり', who: 'staff' },
            { title: 'ポータルと紐付ける', sub: '案件の詳細のいちばん上「ポータル連携」', who: 'staff' },
            { title: '毎朝6時に同期', sub: '状態・申請内容（ツール・金額）を取り込む', who: 'auto' },
            { title: '採択', sub: `${toStage('adopted') || '段階が進む'}・社内用グループに1通`, who: 'auto', tone: DONE },
          ]}
        />
        <Note>
          紐付けは、交付申請番号を入れるか候補を押すだけです。紐付けるとすぐに状態が入り、回次・補助金額・ツールが空欄ならポータルの内容から入ります。ポータルの「状態」は自動で更新するもので、手では書き換えられません。
        </Note>
        <More title="くわしく: ポータルの案件との照合のしかた・同期でしていること">
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { step: '① 申請番号', hit: '一致 → そのまま紐付け', tone: DONE },
              { step: '② 法人番号', hit: '一致 → 申請番号を自動で入れて紐付け', tone: DONE },
              { step: '③ 会社名', hit: '似ている → 「候補」に出すだけ。人が選んで確定', tone: 'border-warn/60 bg-white' },
            ].map((x) => (
              <div key={x.step} className={`rounded-md border p-3 ${x.tone}`}>
                <div className="font-semibold text-ink">{x.step}</div>
                <div className="text-xs mt-1">{x.hit}</div>
              </div>
            ))}
          </div>
          <ul className="text-xs space-y-0.5 list-disc pl-4">
            <li>毎朝6時に、ベンダーごとにポータルへログインして全件を読み、前回と変わった案件だけ変更履歴に残します。</li>
            <li>段階の「ポータル連動の語」（例: 採択・交付決定）がポータルの状態に出たら、その段階へ進めます。</li>
            <li>紐付いた案件は「交付申請 確認」の画面も読み、ITツール名・小計・補助金申請額を取り込みます（1回10件まで。残りは次の日）。</li>
            <li>
              手で今すぐ同期したいときは <L href="/admin/portal">ポータル案件</L> の「同期」を押します。
            </li>
          </ul>
        </More>
      </Phase>

      {/* ───────── フェーズ4 ───────── */}
      <Phase
        no={4}
        lead="採択されると、ベンダーからお客様への契約書が自動で作られます。署名URLをお客様に送り、請求書を作ります。発行元はその案件のベンダーで、宛名・品目・金額はポータルの申請内容から入ります。"
        pages={[
          { href: '/admin/dashboard', label: '案件一覧 → 案件の詳細' },
          { href: '/admin/vendors', label: 'ベンダー' },
        ]}
      >
        <FlowRow
          items={[
            { title: '契約書ができる', sub: '採択＋ポータルのツールと金額が読めたら自動で', who: 'auto' },
            { title: '署名URLを送る', sub: '案件の詳細「ベンダーからお客様への書類」から（紙なら印刷用PDF）', who: 'staff' },
            { title: '請求書を作る', sub: 'ITツールごとの小計＋消費税10%', who: 'staff' },
            { title: 'お客様が署名', sub: '締結済みPDFが残る', who: 'customer', tone: DONE },
          ]}
        />
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>請求書は、作る前に宛名・発行日・品目・金額を直せます。「プレビュー」で見た目も確かめられます。</li>
          <li>契約書が自動で作られないときは、その欄に理由（例: ベンダーの住所が未入力）が出ます。入れて保存すると作られます。</li>
          <li>直したいときは「作り直す」。前の請求書は無効になり、新しい番号で作られます。契約書も、未署名なら作り直せます（前のURLは使えなくなります）。</li>
          <li>
            ポータルの申請内容がまだ読めていない案件では、品目が空になります。手で入れるか、次の朝の同期を待ってください。
          </li>
          <li>契約書の文面は、全ベンダー共通の既定の文面（第1条〜第12条。金額と内訳はポータルの内容から入る）です。合意管轄の裁判所などベンダーごとに違うところは、<L href="/admin/vendors">ベンダー</L> の「請求書・契約書」で直せます。甲（お客様）の所在地・代表者が空なら、お客様が署名のときに入れます。</li>
        </ul>
        <Note>
          採択の時点で、自社のフィーの<strong>見込み額</strong>も自動で計算されます（案件の詳細と <L href="/admin/billing">売上・請求</L> の売上見込みに出ます）。
        </Note>
      </Phase>

      {/* ───────── フェーズ5 ───────── */}
      <Phase
        no={5}
        lead="交付決定でフィーが確定し、請求のタイミングが来ると「請求予定」ができます。自社からベンダーへフィーの請求書を出し、入金を記録して完了です。"
        pages={[
          { href: '/admin/billing', label: '売上・請求' },
          { href: '/admin/settings#invoice', label: '設定の「請求書」' },
        ]}
      >
        <FlowRow
          items={[
            { title: '請求予定ができる', sub: 'チェック「請求書発行」も追加', who: 'auto' },
            { title: '請求書を作る', sub: '売上・請求 →「請求書を作る」（ベンダーあて）', who: 'staff' },
            { title: '「入金確認」が立つ', sub: '「請求書発行」は完了に', who: 'auto' },
            { title: '入金日を入れる', sub: '「入金確認」も完了に', who: 'staff', tone: DONE },
          ]}
        />
        <div className="text-xs rounded-md border border-rule p-3 space-y-0.5">
          <div className="flex items-center font-semibold text-mute">
            いまの請求書の設定
            <Live />
          </div>
          <div>
            請求元: {invoiceSettings.issuer_name || '（未設定）'}・登録番号: {invoiceSettings.registration_no || '（未設定）'}
          </div>
          <div>
            フィーの金額は{invoiceSettings.tax_mode === 'inclusive' ? '税込' : '税別'}（消費税 {Math.round(invoiceSettings.tax_rate * 100)}%
            {invoiceSettings.tax_mode === 'inclusive' ? 'を含む' : 'を上乗せ'}）・支払期限は発行日から{invoiceSettings.payment_days}日
            {invoiceSettings.payment_end_of_month ? '後の月末' : '後'}・請求書番号は「
            {invoiceSettings.number_prefix ? `${invoiceSettings.number_prefix}-` : ''}202611-001」の形
          </div>
          {invoiceMissing.length > 0 && (
            <div className="text-accent">まだ入っていない項目: {invoiceMissing.join('・')}（入れるまで請求書は作れません）</div>
          )}
        </div>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>請求書の宛先は、最初から案件のベンダーが入っています（ベンダーが無い案件はお客様）。</li>
          <li>ほかのツールで請求書を作ったときは、発行日を入れるか「ほかで作った（今日発行した）」を押します。</li>
          <li>請求のタイミングを待たずに請求したいときは、案件の詳細の「請求」で「請求予定を手で作る」を押します（金額と発生日を入れる。手で作った金額は自動の計算で上書きされません）。</li>
          <li>ポータルより先に採択や交付決定が分かったときは、案件の詳細の「節目の日付」に日付を入れて保存してください。</li>
        </ul>
        <More title="くわしく: 節目ごとに自動で起きること">
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
          <p className="text-xs">補助金額を直すと、フィーと（請求書を発行する前なら）請求額も計算し直されます。</p>
        </More>
      </Phase>

      {/* ───────── 毎日 ───────── */}
      <Section id="daily" title="毎日の使い方" lead="フェーズに関係なく、ふだん見るところです。">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { time: '朝', what: '社内用グループの「ポータル同期」の通知で、状態が変わった案件を確認', href: '/admin/portal', link: 'ポータル案件' },
            { time: '朝', what: '「次の期限」の見出しを押して近い順に並べ、期限切れ（赤字）のチェック項目を片付ける', href: '/admin/dashboard?sort=due', link: '案件一覧（期限順）' },
            { time: '随時', what: 'トークで未読（緑の丸）のグループを開き、お客様の質問や送られた書類を確認する', href: '/admin/talk', link: 'トーク' },
            { time: '随時', what: '書類提出の通知が来たら、担当者確認が必要な書類と照合結果を見る', href: '/admin/dashboard?status=submitted', link: '送信済みの案件' },
            { time: '週1回', what: '「未紐付け」のグループと「送れなかった通知」がないか確認', href: '/admin/line', link: 'LINE' },
            { time: '請求のたび', what: 'フィーの請求書を作って送り、入金されたら入金日を入れる', href: '/admin/billing', link: '売上・請求' },
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
        <More title="トーク（LINEの会話を見る・返信する）の使い方">
          <FlowRow
            items={[
              { title: 'グループに投稿', sub: 'お客様・担当者がLINEで送る', who: 'customer' },
              { title: 'トークに保存', sub: '文章・画像・ファイル・スタンプ', who: 'auto' },
              { title: 'トークで読む', sub: '未読の数が緑の丸で出る', who: 'staff' },
              { title: 'ここから返信', sub: '公式LINEの名前でグループに届く', who: 'staff' },
            ]}
          />
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Enter で送信、Shift＋Enter で改行。画像は左のボタン・貼り付け・ドラッグで送れます（PDF などのファイルは送れません）。</li>
            <li>送ったメッセージには「送る人」（右下で選ぶ）の名前が残ります。お客様には公式LINEからの投稿として見えます。</li>
            <li>システムからの通知も、そのグループのトークに残ります。公式LINEが入る前の会話は表示できません。</li>
            <li>
              トークから送ると、1回ごとに<b>グループの人数分</b>の通数を使います（月200通まで）。ふだんのやり取りはLINEアプリから送っても、トークに残ります。
            </li>
          </ul>
        </More>
      </Section>

      {/* ───────── こんなときは ───────── */}
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
                ['同意書の内容を直したい', '署名前なら案件の情報を直して「今の情報で作り直す」→ 新しいURLを送る。締結後は作り直せない'],
                ['グループLINEが案件に紐付かない', 'LINE の画面で、そのグループの「案件」から正しい案件を選ぶ。グループ名を直してから「自動で紐付け直す」でも可'],
                ['書類が不備になるが内容は正しい', '案件の詳細の書類で読み取った値を確認。条件は設定の「書類の判定」で変えられる'],
                ['ポータルの状態が入らない', '案件の詳細のいちばん上の「ポータル連携」で申請番号を入れる（または候補から選ぶ）。同期が失敗していないかはポータル案件の画面で確認'],
                ['段階が自動で進まない', '設定の段階で「こうなったら自動で進む」「ポータル連動の語」を確認。手で段階を変えてもよい'],
                ['ベンダーの請求書の品目が空', 'ポータルの申請内容がまだ読めていない。品目を手で入れるか、次の朝の同期を待つ'],
                ['請求書が作れない（項目が足りない）', '自社の分は設定の「請求書」、ベンダーの分はベンダーの「請求書・契約書」で、住所・登録番号・振込先を入れる'],
                ['トークに会話が出ない', '公式LINEがそのグループに入っているか確認（入る前の会話は出ない）。LINE の画面の「グループ名を取り直す」で退出したグループが分かる'],
                ['トークから送れない・通知が来ない', '理由が「送れませんでした」や LINE の画面の「送れなかった通知」に出る。月の上限（200通）なら来月まで LINE アプリから送る'],
                ['既存の案件をまとめて入れたい', '案件一覧の右上「CSVで一括登録」からひな形をダウンロードして入力'],
                ['案件を Excel で見たい・経理に渡したい', '案件一覧の右上「CSVで出力」。段階・ツール・補助金額・フィー・節目の日付・請求と入金まで入る'],
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

      {/* ───────── 参考 ───────── */}
      <section id="reference" className="space-y-2 scroll-mt-20">
        <h2 className="text-lg font-bold text-ink">参考（必要なときに開く）</h2>

        <More title="画面の一覧">
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
          <Note>
            表は、列の見出しを押すと並べ替えられます。押すたびに「小さい・古い順 → 大きい・新しい順 → 元の順」と切り替わり、並べ方は次に開いたときも残ります（設定の表は「順番」に意味があるので並べ替えはありません）。
          </Note>
        </More>

        <More title="段階の進み方">
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
            自動で動くのは先の段階へだけで、戻ることはありません（手では自由に変えられます）。ポータル連動の語は「最も長く一致した語」を優先します（「不採択」は「採択」より優先）。段階は <L href="/admin/settings#stages">設定</L> で変えられます。
          </Note>
        </More>

        <More title="チェック項目">
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
            段階と並行して進める作業です。案件一覧で「チェック: 未完了の○○」を選ぶと、その作業が残っている案件だけを出せます。項目は <L href="/admin/settings#checks">設定</L> で追加できます。
          </Note>
        </More>

        <More title="LINEの通知と通数">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
            <div className="rounded-md border border-rule p-3">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <Users className="w-4 h-4" />
                顧客のグループ
              </div>
              <div className="text-[11px] text-mute mt-1">顧客＋担当者＋公式LINE</div>
            </div>
            <div className="text-center text-[11px] text-mute">
              <ArrowRight className="hidden md:block w-5 h-5 mx-auto" />
              <ArrowDown className="md:hidden w-5 h-5 mx-auto" />
              グループ名で紐付け
            </div>
            <div className="rounded-md border-2 border-teal p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 font-semibold text-ink">
                <MessageCircle className="w-4 h-4 text-teal" />
                公式LINE ＋ Tsumugi
              </div>
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
                <tr>
                  <td className="py-1.5 pr-3">トークから送ったとき</td>
                  <td className="py-1.5 pr-3">そのグループ</td>
                  <td className="py-1.5">1通×人数</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Note>
            公式LINEは無料プラン（月200通。送った回数×受け取る人数で数える）です。上限などで送れなかった通知は <L href="/admin/line">LINE</L> の「送れなかった通知」に残り、あとから再送できます。
          </Note>
        </More>
      </section>
    </div>
  );
}
