import Link from 'next/link';
import { ArrowRight, Check, Clock, Flag, User, Users } from 'lucide-react';
import { PHASE_TITLES, type NextAction, type Step } from '@/lib/cases/nextAction';

// 案件の詳細のいちばん上: いまどのフェーズか（①〜⑤）と、次にやること1つ

const CIRCLED = ['', '①', '②', '③', '④', '⑤'];

function Go({ step, primary }: { step: Step; primary?: boolean }) {
  const cls = primary
    ? 'inline-flex items-center gap-1.5 rounded-md bg-ink text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700'
    : 'inline-flex items-center gap-1 text-xs text-teal hover:underline font-semibold';
  const body = (
    <>
      {step.targetLabel}
      <ArrowRight className={primary ? 'w-4 h-4' : 'w-3 h-3'} />
    </>
  );
  return step.target.startsWith('#') ? (
    <a href={step.target} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={step.target} className={cls}>
      {body}
    </Link>
  );
}

export function NextActionCard({ na }: { na: NextAction }) {
  const phaseSteps = (p: number) => na.steps.filter((s) => s.phase === p);
  const next = na.next;
  const waiting = next && next.who !== 'staff';

  return (
    <section className="rounded-md border-2 border-ink bg-white p-4 space-y-4">
      {/* フェーズ ①〜⑤ */}
      <ol className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((p) => {
          const done = na.phase > p || (na.finished === 'done' && true);
          const current = na.phase === p && !na.finished;
          return (
            <li
              key={p}
              className={`rounded-md px-2 py-1.5 text-center border ${
                current ? 'bg-ink text-white border-ink' : done ? 'bg-teal-light/50 border-teal/40 text-ink' : 'bg-white border-rule text-mute'
              }`}
            >
              <div className="text-base font-bold leading-none">{done && !current ? <Check className="w-4 h-4 mx-auto" /> : CIRCLED[p]}</div>
              <div className="text-[10px] sm:text-[11px] mt-1 leading-tight">{PHASE_TITLES[p]}</div>
            </li>
          );
        })}
      </ol>

      {na.finished === 'rejected' ? (
        <div className="flex items-center gap-2 text-sm">
          <Flag className="w-4 h-4 text-accent" />
          <span className="font-semibold">ポータルの状態が不採択などのため、この案件はここで終わりです。</span>
        </div>
      ) : na.finished === 'done' || !next ? (
        <div className="flex items-center gap-2 text-sm">
          <Check className="w-5 h-5 text-ok" />
          <span className="font-semibold">すべて完了しました（入金まで記録済み）。</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-mute flex items-center gap-1">
              {waiting ? <Clock className="w-3.5 h-3.5" /> : null}
              {waiting ? '待っていること' : '次にやること'}
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-rule px-1.5 py-0 text-[10px] font-semibold">
                {next.who === 'staff' ? <Users className="w-3 h-3" /> : next.who === 'customer' ? <User className="w-3 h-3" /> : null}
                {next.who === 'staff' ? '社内' : next.who === 'customer' ? 'お客様' : '自動'}
              </span>
            </div>
            <div className={`mt-0.5 font-bold text-ink ${waiting ? 'text-base' : 'text-lg'}`}>{next.action}</div>
            {/* このフェーズのほかの項目 */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {phaseSteps(next.phase).map((s) => (
                <span
                  key={s.key}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${
                    s.done ? 'border-teal/40 bg-teal-light/50 text-ink' : s.key === next.key ? 'border-ink text-ink font-semibold' : 'border-rule text-mute'
                  }`}
                >
                  {s.done ? <Check className="w-3 h-3" /> : null}
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <Go step={next} primary={!waiting} />
          </div>
        </div>
      )}

      {na.leftovers.length > 0 && (
        <div className="text-xs text-mute border-t border-rule pt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>前のフェーズのやり残し:</span>
          {na.leftovers.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              {s.label}
              <Go step={s} />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
