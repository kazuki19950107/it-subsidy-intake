import { randomBytes } from 'crypto';

const TOKEN_VALIDITY_DAYS = 30;

export function generateApplicationToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_VALIDITY_DAYS);
  return { token, expiresAt };
}

export function isTokenExpired(expiresAt: string | Date): boolean {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return exp.getTime() < Date.now();
}

export function generateShortId(): string {
  // 管理者向け表示用 ID (例: ABC-1234)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    prefix += chars[Math.floor(Math.random() * chars.length)];
  }
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += nums[Math.floor(Math.random() * nums.length)];
  }
  return `${prefix}-${suffix}`;
}
