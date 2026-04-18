import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const MODEL = 'claude-sonnet-4-5-20250929';
export const MAX_TOKENS = 2048;

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export function normalizeMediaType(mime: string): SupportedMediaType {
  const m = mime.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg' || m === 'jpeg' || m === 'jpg') return 'image/jpeg';
  if (m === 'image/png' || m === 'png') return 'image/png';
  if (m === 'image/webp' || m === 'webp') return 'image/webp';
  if (m === 'image/gif' || m === 'gif') return 'image/gif';
  return 'image/jpeg';
}
