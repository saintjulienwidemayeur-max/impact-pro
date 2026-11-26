import { Prisma } from '@prisma/client';
import { unitPriceFor } from '../catalog/catalog.service';
import { formatReference } from '../custom-orders/custom-orders.service';
import { detectLogoType, sanitizeFilename } from './file-signature';

describe('detectLogoType', () => {
  it.each([
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'image/png'],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'image/webp'],
    [Buffer.from('%PDF-1.7'), 'application/pdf'],
  ])('recognises %#', (buf, type) => {
    expect(detectLogoType(buf)).toBe(type);
  });

  it.each([
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from('<?xml version="1.0"?><svg/>'),
    Buffer.from('GIF89a'),
    Buffer.from('MZ'),
    Buffer.alloc(0),
  ])('rejects unsupported content %#', (buf) => {
    expect(detectLogoType(buf)).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it('drops directories and unsafe characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\x\\Logo <final>.png')).toBe('Logo _final_.png');
    expect(sanitizeFilename(undefined)).toBe('logo');
  });
});

describe('unitPriceFor', () => {
  const d = (v: string) => new Prisma.Decimal(v);
  const tiers = [
    { minQty: 12, unitPrice: d('650') },
    { minQty: 50, unitPrice: d('575') },
    { minQty: 100, unitPrice: d('495') },
  ];
  it.each([
    [12, '650'],
    [49, '650'],
    [50, '575'],
    [99, '575'],
    [100, '495'],
    [5000, '495'],
  ])('quantity %i → %s', (qty, price) => {
    expect(unitPriceFor(d('700'), tiers, qty).toString()).toBe(price);
  });
  it('falls back to the base price below the first tier or without tiers', () => {
    expect(unitPriceFor(d('700'), tiers, 3).toString()).toBe('700');
    expect(unitPriceFor(d('8500'), [], 3).toString()).toBe('8500');
  });
});

describe('formatReference', () => {
  it('zero-pads the sequence', () => {
    expect(formatReference(42n, 2026)).toBe('IP-2026-000042');
  });
});
