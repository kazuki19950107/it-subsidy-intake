/** アプリの URL（末尾の / は取り除く。環境変数に / 付きで入っていても URL が // にならないように） */
export function appBaseUrl(fallback = ''): string {
  return (process.env.NEXT_PUBLIC_APP_URL || fallback).replace(/\/+$/, '');
}
