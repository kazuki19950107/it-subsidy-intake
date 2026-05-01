// 管理画面用のセッション署名ユーティリティ。
// Cookie には `<exp_unix>.<base64url(HMAC-SHA256(secret, exp_unix))>` を保存する。
// Middleware (Edge ランタイム) でも動かすため Web Crypto を使う。

export const ADMIN_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7日

const enc = new TextEncoder();

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64urlEncode(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): ArrayBuffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replaceAll('-', '+').replaceAll('_', '/') + pad);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

export async function signAdminSession(): Promise<{ value: string; maxAge: number }> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set');
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(exp)));
  return { value: `${exp}.${b64urlEncode(sig)}`, maxAge: ADMIN_SESSION_MAX_AGE_SEC };
}

export async function verifyAdminSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const expStr = value.slice(0, dot);
  const sigB64 = value.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  try {
    const key = await getKey(secret);
    const sig = b64urlDecode(sigB64);
    return await crypto.subtle.verify('HMAC', key, sig, enc.encode(expStr));
  } catch {
    return false;
  }
}

// 平文比較ではなくタイミング攻撃に強い比較
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
