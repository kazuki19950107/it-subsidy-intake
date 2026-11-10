import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// LINE Messaging API の薄いラッパー。
// 無料プラン（月200通）で使うため、push は呼び出し側で最小限にする。応答（reply）は通数を使わない。

const API = 'https://api.line.me/v2/bot';

export function lineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN && !!process.env.LINE_CHANNEL_SECRET;
}

/** Webhook の署名（x-line-signature）を検証する */
export function verifyLineSignature(rawBody: string, signature: string | null, secret = process.env.LINE_CHANNEL_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type LineTextMessage = { type: 'text'; text: string };

export class LineApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
  }
  /** 月の上限に達して送れなかった */
  get isQuotaExceeded(): boolean {
    return this.status === 429 && /monthly limit/i.test(this.body);
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new LineApiError('LINE_CHANNEL_ACCESS_TOKEN が未設定です', 0, '');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LineApiError(`LINE API ${path} が ${res.status} を返しました: ${body.slice(0, 300)}`, res.status, body);
  }
  return res;
}

/** 応答メッセージ（通数を使わない） */
export async function replyMessage(replyToken: string, texts: string[]): Promise<void> {
  await call('/message/reply', {
    method: 'POST',
    body: JSON.stringify({ replyToken, messages: texts.slice(0, 5).map((text) => ({ type: 'text', text })) }),
  });
}

/** プッシュ送信（通数を使う）。送り先はグループ ID など */
export async function pushMessage(to: string, texts: string[]): Promise<void> {
  await call('/message/push', {
    method: 'POST',
    body: JSON.stringify({ to, messages: texts.slice(0, 5).map((text) => ({ type: 'text', text: text.slice(0, 5000) })) }),
  });
}

/** グループ名を取得する */
export async function getGroupSummary(groupId: string): Promise<{ groupId: string; groupName: string }> {
  const res = await call(`/group/${encodeURIComponent(groupId)}/summary`);
  return (await res.json()) as { groupId: string; groupName: string };
}

/** 今月の送信数と上限 */
export async function getQuota(): Promise<{ limit: number | null; used: number }> {
  const [q, c] = await Promise.all([call('/message/quota'), call('/message/quota/consumption')]);
  const quota = (await q.json()) as { type: string; value?: number };
  const consumption = (await c.json()) as { totalUsage: number };
  return { limit: quota.type === 'limited' ? (quota.value ?? null) : null, used: consumption.totalUsage };
}
