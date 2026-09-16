import { describe, expect, it } from 'vitest';
import {
  getCommonExportTargets,
  getFileExtension,
  isSupportedSourceExtension,
  SUPPORTED_FORMATS,
} from './types';

describe('universal format support', () => {
  it('normalizes file extensions', () => {
    expect(getFileExtension('photo.JPEG')).toBe('jpeg');
    expect(getFileExtension('archive')).toBe('archive');
    expect(getFileExtension('')).toBe('');
  });

  it('accepts only declared source extensions', () => {
    expect(isSupportedSourceExtension('PNG')).toBe(true);
    expect(isSupportedSourceExtension('svg')).toBe(true);
    expect(isSupportedSourceExtension('pdf')).toBe(false);
    expect(isSupportedSourceExtension('ico')).toBe(false);
  });

  it('returns only targets supported by every queued source', () => {
    expect(getCommonExportTargets(['png', 'svg'])).toEqual(['jpg', 'webp']);
    expect(getCommonExportTargets(['png', 'webp'])).toEqual(['jpg', 'svg']);
    expect(getCommonExportTargets(['bmp', 'svg'])).toEqual(['png', 'jpg', 'webp']);
  });

  it('fails closed for empty or unknown source lists', () => {
    expect(getCommonExportTargets([])).toEqual([]);
    expect(getCommonExportTargets(['pdf'])).toEqual([]);
    expect(getCommonExportTargets(['png', 'pdf'])).toEqual([]);
  });

  it('does not expose unverified PDF, ICO, or BMP output encoders', () => {
    const targets = Object.values(SUPPORTED_FORMATS).flatMap((format) => format.canExportTo);
    expect(targets).not.toContain('pdf');
    expect(targets).not.toContain('ico');
    expect(targets).not.toContain('bmp');
  });
});
