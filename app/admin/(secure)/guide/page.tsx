import Link from 'next/link';

export const metadata = { title: '使い方 | 補助金 案件管理' };

const TOC = [
  { id: 'flow', label: '全体の流れ' },
  { id: 'screens', label: '画面の一覧' },
  { id: 'register', label: '1. 案件を登録する' },
  { id: 'contract', label: '2. 同意書に署名してもらう' },
  { id: 'documents', label: '3. 書類を提出してもらう' },
  { id: 'line', label: '4. グループLINEを作る' },
  { id: 'portal', label: '5. 申請とポータル同期' },
  { id: 'stage', label: '6. 段階とチェック項目' },
  { id: 'fee', label: '7. フィーと請求・入金' },
  { id: 'daily', label: '毎日の使い方' },
  { id: 'settings', label: '設定を変える' },
  { id: 'csv', label: '既存案件をCSVで登録' },
  { id: 'trouble', label: 'こんなときは' },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-md border border-rule p-5 space-y-3 scroll-mt-20">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="text-sm text-charcoal leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal list-outside pl-5 space-y-1.5">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-off-white border border-rule px-3 py-2 text-xs text-charcoal">{children}</div>;
}

function L({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-teal hover:underline font-semibold">
      {children}
    </Link>
  );
}

const FLOW = [
  ['案件を登録', '社内', '会社情報を入れると同意書が自動で作られる'],
  ['同意書に署名', '顧客', '専用URLで内容を確認し、署名して締結'],
  ['書類を提出', '顧客', '専用フォームでアップロード。AIがその場で判定'],
  ['社内に通知', '自動', '書類がそろうと公式LINEから社内用グループへ'],
  ['グループLINE作成', '社内', '公式LINEを招待すると案件に自動で紐付く'],
  ['ポータルで申請', '社内', 'これまでどおり'],
  ['ポータル同期', '自動', '毎朝6時。状態の変化を取り込み、段階を進める'],
  ['採択・交付決定', '自動', 'フィーを計算し、請求予定を作る'],
  ['請求・入金', '社内', '請求書発行日・入金日を入れてチェックを完了'],
];

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">使い方</h1>
        <p className="text-sm text-mute mt-1">
          案件の登録から、同意書・書類提出・申請・採択・請求・入金までを、この画面でまとめて管理します。
          グループLINEを1つずつ開いて進捗を確認する必要はありません。
        </p>
        <nav className="flex flex-wrap gap-2 mt-3 text-xs">
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="px-3 py-1 rounded-full border border-rule bg-white hover:bg-teal-light">
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="flow" title="全体の流れ">
        <ol className="space-y-2">
          {FLOW.map(([step, who, desc], i) => (
            <li key={step} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal text-white text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{step}</span>
                <span
                  className={`ml-2 text-[11px] px-1.5 py-0.5 rounded ${
                    who === '自動' ? 'bg-teal-light text-teal-dark' : who === '顧客' ? 'bg-off-white border border-rule' : 'bg-ink text-white'
                  }`}
                >
                  {who}
                </span>
                <span className="block text-xs text-mute">{desc}</span>
              </span>
            </li>
          ))}
        </ol>
        <Note>
          社内が手を動かすのは「登録」「グループLINE作成」「ポータルで申請」「請求・入金の記録」です。それ以外の進捗は、同意書の締結・書類の提出・ポータル同期をきっかけに自動で記録され、段階が進みます。
        </Note>
      </Section>

      <Section id="screens" title="画面の一覧">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-rule/50">
              {[
                ['/admin/dashboard', '案件一覧', '全案件の段階・ポータル状態・次の期限。絞り込みと並べ替え'],
                ['/admin/dashboard/new', '新規登録', '案件の登録。申請URLと同意書の署名URLが出る'],
                ['/admin/portal', 'ポータル案件', 'ポータルから取り込んだ案件と、手動の同期'],
                ['/admin/billing', '売上・請求', '請求予定の管理と、売上見込みの集計'],
                ['/admin/line', 'LINE', 'グループの紐付け・社内用の指定・送れなかった通知'],
                ['/admin/settings', '設定', '段階・チェック項目・ツールとフィー・社内担当・書類の判定'],
                ['/admin/vendors', 'ベンダー', 'ポータルのログイン情報など'],
              ].map(([href, name, desc]) => (
                <tr key={href}>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <L href={href}>{name}</L>
                  </td>
                  <td className="py-2 text-charcoal">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="register" title="1. 案件を登録する">
        <Steps
          items={[
            <>
              <L href="/admin/dashboard/new">新規登録</L>を開く
            </>,
            '区分（法人／個人事業主）、会社名、法人番号（13桁）、代表者、所在地、先方の担当者・連絡先を入れる',
            'ツール（BU・LUなど）、申請回次、社内担当、紹介元を選ぶ',
            '「案件を登録して申請URLを発行する」を押す',
            '表示された「申請URL（書類提出フォーム）」と「同意書の署名URL」をコピーして、お客様に送る',
          ]}
        />
        <Note>
          会社名と法人番号は、提出された書類との照合に使います。正しく入れておくと、別の会社の書類が出されたときに自動で不備になります。
          URLに有効期限はありません。
        </Note>
      </Section>

      <Section id="contract" title="2. 同意書に署名してもらう">
        <p>お客様は署名URLを開き、内容を確認して、氏名の入力または手書きで署名します。締結すると次のことが自動で行われます。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>締結済みのPDFが保存される（署名日時・IPアドレス・署名者と、PDFのSHA-256を記録）</li>
          <li>案件の段階が「書類回収中」に進む</li>
        </ul>
        <p>
          案件の詳細の「同意書（電子契約）」で、状態（未確認／確認済み・未署名／締結済み）とPDFを確認できます。
          会社情報を直したときは、署名前なら「今の情報で作り直す」を押してください（前のURLは使えなくなるので、新しいURLを送り直します）。
        </p>
        <Note>同意書の文面は仮のものです。差し替えは開発側で行います。</Note>
      </Section>

      <Section id="documents" title="3. 書類を提出してもらう">
        <p>お客様は申請URLから基本情報・GビズIDの状況を入力し、書類をアップロードします。AIが読み取って判定し、不備はその場でお客様に表示されます。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>登記簿謄本: 発行から3か月以内</li>
          <li>納税証明書: 「その3」であること</li>
          <li>決算書: 損益計算書・販管費・貸借対照表がそろった直近期のもの</li>
          <li>写真で撮った書類: 四隅がすべて写っていること</li>
          <li>会社名・法人番号が、登録した会社情報と一致すること</li>
        </ul>
        <p>
          すべてそろって送信されると、公式LINEから<strong>社内用グループに通知</strong>が届き、段階が「申請準備」に進みます。
          読み取りに自信がない書類は、案件の詳細の上部に「担当者確認が必要な書類」として表示されるので、中身を目で確認してください。
        </p>
      </Section>

      <Section id="line" title="4. グループLINEを作る">
        <Steps
          items={[
            <>
              グループ名を <code className="bg-off-white px-1 rounded">回次＋ツール×会社名様</code> にする（例:{' '}
              <code className="bg-off-white px-1 rounded">3次BU×MEM株式会社様</code>）
            </>,
            'お客様と担当者が入ったグループに、公式LINEを招待する',
            '公式LINEがあいさつを返し、グループ名から案件に自動で紐付く',
          ]}
        />
        <p>
          紐付けの結果は <L href="/admin/line">LINE</L> で確認できます。同じ会社名の案件が複数あるなど1件に絞れないときは「未紐付け」になるので、候補から案件を選んでください。
          グループ内の会話に会社名が出てくると、自動で絞り込まれることもあります。
        </p>
        <Note>
          全角・半角、「株式会社」の有無、末尾の「様」、空白の違いは気にしなくて大丈夫です。グループ名を後から変えても、毎朝の確認で取り直して紐付けをやり直します。
        </Note>
      </Section>

      <Section id="portal" title="5. 申請とポータル同期">
        <p>申請はこれまでどおりポータルで行います。ポータルの状態は毎朝6時に自動で取り込みます（<L href="/admin/portal">ポータル案件</L>の「今すぐ同期」で手動でも可能）。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>案件との照合は「申請番号 → 法人番号 → 会社名」の順。法人番号で一致すると申請番号が自動で入る</li>
          <li>会社名で似ているものは「候補」として案件の詳細に出るだけなので、正しいものを選んで確定する</li>
          <li>状態が変わった案件は変更履歴に残り、まとめて1通、社内用グループに通知される</li>
          <li>「採択」「交付決定」などになると、段階が自動で進む</li>
          <li>ログインできないなど同期に失敗したときは、すぐに社内用グループに通知される</li>
        </ul>
        <Note>ポータルの状態は自動更新専用の欄なので、手で書き換えることはできません。</Note>
      </Section>

      <Section id="stage" title="6. 段階とチェック項目">
        <p>
          <strong>段階</strong>は社内の進み具合です（同意書待ち → 書類回収中 → 申請準備 → 申請済み → 採択 → 交付決定 → 補助金入金済）。
          ほとんどは自動で進みますが、案件の詳細の「社内の段階」から手で変えることもできます。自動で動くのは先の段階へだけで、戻ることはありません。
        </p>
        <p>
          <strong>チェック項目</strong>は、段階と並行して進める作業（請求書発行・入金確認など）です。案件の詳細でチェックを入れると完了になり、期限も変えられます。
          案件一覧で「チェック: 未完了の○○」を選ぶと、その作業が残っている案件だけを出せます。「並べ替え: 次の期限が近い順」で期限の近いものから確認できます。
        </p>
        <Note>段階・チェック項目・期限・補助金額などの変更は、すべて案件の詳細の「変更履歴」に、誰が（社内・ポータル・LINE・顧客）変えたかと一緒に残ります。</Note>
      </Section>

      <Section id="fee" title="7. フィーと請求・入金">
        <Steps
          items={[
            '案件の詳細で「補助金額」を入れる',
            '採択になるとフィー見込み額、交付決定になるとフィー確定額が計算される（BU は 15%、LU は 10%）',
            '補助金の入金後（ツールの請求タイミング）になると、請求予定が作られ、チェック「請求書発行」が立つ',
            <>
              <L href="/admin/billing">売上・請求</L>で請求書を発行したら「今日発行した」を押す（または発行日を入れて保存）→「請求書発行」が完了になり「入金確認」が立つ
            </>,
            '入金されたら入金日を入れて保存 →「入金確認」が完了になる',
          ]}
        />
        <p>
          ポータルで採択などが取り込まれる前に分かった場合は、案件の詳細の「節目の日付」に日付を入れて保存してください。段階も自動で進みます。
          補助金額を直すと、フィーと（請求書を発行する前なら）請求額も計算し直されます。
        </p>
        <p>売上・請求の画面では、ツール別・回次別・月別の売上見込み（見込み・うち確定・請求済み・入金済み）を確認できます。</p>
      </Section>

      <Section id="daily" title="毎日の使い方">
        <Steps
          items={[
            '朝、社内用グループに届いた「ポータル同期」の通知で、状態が変わった案件を確認する',
            <>
              <L href="/admin/dashboard?sort=due">案件一覧（期限が近い順）</L>で、期限切れ（赤字）や期限の近いチェック項目を片付ける
            </>,
            <>
              <L href="/admin/line">LINE</L>で「未紐付け」のグループと「送れなかった通知」がないか確認する
            </>,
            '書類提出の通知が来た案件は、詳細で「担当者確認が必要な書類」と照合結果を確認する',
          ]}
        />
      </Section>

      <Section id="settings" title="設定を変える">
        <p>
          <L href="/admin/settings">設定</L>で次のものを変えられます。コードを直す必要はありません。
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>段階</strong>: 追加・名前・色・並び順・削除。「節目」（この段階に入るとフィーや請求の基準日が入る）、「ポータル連動」（ポータルの状態にこの語が含まれたら進める）、「顧客に通知」（この段階に入ったらお客様のグループに定型文を送る。初期はオフ）
          </li>
          <li>
            <strong>チェック項目</strong>: 追加・名前・期限（日数）・どの段階で自動追加するか
          </li>
          <li>
            <strong>ツールとフィー</strong>: 頭文字・計算方法（補助金額×率／定額）・請求タイミング
          </li>
          <li>
            <strong>社内担当</strong>: 案件の担当者として選ぶ人
          </li>
          <li>
            <strong>書類の判定</strong>: 必須かどうか・受け付ける形式・期限・納税証明書の種類・決算書にそろえる書類
          </li>
        </ul>
        <Note>
          「顧客に通知」や手動のテスト送信は公式LINEの通数を使います。無料プランは月200通（送信回数×受け取る人数）なので、必要な段階だけオンにしてください。
        </Note>
      </Section>

      <Section id="csv" title="既存案件をCSVで登録">
        <Steps
          items={[
            <>
              <L href="/admin/import">CSVで一括登録</L>を開き、「ひな形をダウンロード」する
            </>,
            'Excel などで1行に1案件を書く（「会社名」以外は省略可。ツール・社内担当・段階は設定にある名前と同じにする）',
            'ファイルを選んで「内容を確認」→ 誤りや重複の注意が出たら直す',
            '「○件を登録」を押す',
          ]}
        />
        <Note>申請番号を入れておくと、取り込み済みのポータルの状態がすぐに反映されます。締結済みの既存案件なら「同意書も作る」はオフのままで構いません。</Note>
      </Section>

      <Section id="trouble" title="こんなときは">
        <dl className="space-y-3">
          {[
            ['グループLINEが案件に紐付かない', 'LINE の画面で、そのグループの「案件」から正しい案件を選んでください。グループ名を直してから「自動で紐付け直す」を押す方法もあります。'],
            ['社内用グループに通知が来ない', 'LINE の画面で、送れなかった通知と理由（月の上限・社内用グループ未登録など）を確認し、「再送」してください。'],
            ['ポータルの状態が変わらない', 'ポータル案件の画面で前回の同期の結果を確認してください。失敗していれば、ベンダーのポータルのパスワードが変わっていないかを確認します。'],
            ['段階が自動で進まない', '設定の段階で、その段階の「節目」や「ポータル連動」の語が合っているか確認してください。手で段階を変えることもできます。'],
            ['書類が不備になるが内容は正しい', '案件の詳細の書類で、読み取った値を確認してください。判定の条件は設定の「書類の判定」で変えられます。'],
            ['同意書の内容を直したい', '署名前なら、案件の情報を直してから「今の情報で作り直す」を押し、新しいURLを送ってください。締結後は作り直せません。'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className="text-charcoal">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
