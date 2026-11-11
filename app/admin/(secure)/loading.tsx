// 画面を移るとき、押した直後に出す読み込み中の表示（サーバーの返事を待つ間、画面が止まって見えないように）
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="読み込み中">
      <div className="h-7 w-48 rounded bg-zinc-200" />
      <div className="h-4 w-80 max-w-full rounded bg-zinc-100" />
      <div className="rounded-md border border-rule bg-white p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-zinc-100" style={{ width: `${90 - i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}
