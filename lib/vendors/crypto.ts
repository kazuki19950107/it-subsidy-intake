import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// ベンダーポータルのパスワード暗号化（AES-256-GCM）。
// 鍵は VENDOR_CREDENTIAL_KEY（未設定なら ADMIN_SESSION_SECRET）から SHA-256 で導出する。
// 保存形式: "v1.<iv b64url>.<ciphertext b64url>.<authTag b64url>"

const VERSION = 'v1';

function getKey(): Buffer {
  const secret = process.env.VENDOR_CREDENTIAL_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('VENDOR_CREDENTIAL_KEY / ADMIN_SESSION_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), enc.toString('base64url'), tag.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ver, ivB64, encB64, tagB64] = payload.split('.');
  if (ver !== VERSION || !ivB64 || !encB64 || !tagB64) {
    throw new Error('暗号化データの形式が不正です');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64url')), decipher.final()]);
  return dec.toString('utf8');
}
