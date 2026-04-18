import { createHash } from 'crypto';

export function sha256(buffer: Buffer | Uint8Array | ArrayBuffer): string {
  const hash = createHash('sha256');
  if (buffer instanceof ArrayBuffer) {
    hash.update(Buffer.from(buffer));
  } else {
    hash.update(buffer as Buffer);
  }
  return hash.digest('hex');
}
