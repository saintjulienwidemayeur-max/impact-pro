/**
 * Detects the real file type from its leading bytes ("magic numbers").
 * The client-declared MIME type and file extension are never trusted.
 * Only formats accepted for logo artwork are recognised; SVG is deliberately unsupported (it can carry scripts).
 */
export type AllowedLogoType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

export const ALLOWED_LOGO_TYPES: readonly AllowedLogoType[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export function detectLogoType(buf: Buffer): AllowedLogoType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

/** Keeps a display-safe version of the client filename (never used on disk). */
export function sanitizeFilename(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'logo';
}
