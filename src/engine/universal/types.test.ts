import { describe, expect, it } from 'vitest';
import {
  getCommonExportTargets,
  getDefaultExportTarget,
  getFileExtension,
  isSupportedConversion,
  isSupportedSourceExtension,
  SUPPORTED_FORMATS,
} from './types';

describe('universal format support', () => {
  it('normalizes file extensions', () => {
    expect(getFileExtension('photo.JPEG')).toBe('jpeg');
    expect(getFileExtension('archive')).toBe('archive');
    expect(getFileExtension('')).toBe('');
  });

  it('accepts only declared source extensions including pdf', () => {
    expect(isSupportedSourceExtension('PNG')).toBe(true);
    expect(isSupportedSourceExtension('svg')).toBe(true);
    expect(isSupportedSourceExtension('pdf')).toBe(true);
    expect(isSupportedSourceExtension('PDF')).toBe(true);
    expect(isSupportedSourceExtension('ico')).toBe(false);
  });

  it('verifies PDF format spec properties', () => {
    expect(SUPPORTED_FORMATS.pdf).toBeDefined();
    expect(SUPPORTED_FORMATS.pdf.ext).toBe('pdf');
    expect(SUPPORTED_FORMATS.pdf.mime).toBe('application/pdf');
    expect(SUPPORTED_FORMATS.pdf.category).toBe('document');
    expect(SUPPORTED_FORMATS.pdf.canExportTo).toEqual(['png', 'jpg', 'webp', 'svg']);
  });

  it('returns only targets supported by every queued source', () => {
    expect(getCommonExportTargets(['png', 'svg'])).toEqual(['jpg', 'webp', 'pdf', 'png']);
    expect(getCommonExportTargets(['png', 'webp'])).toEqual(['jpg', 'webp', 'svg', 'pdf', 'png']);
    expect(getCommonExportTargets(['bmp', 'svg'])).toEqual(['png', 'jpg', 'webp', 'pdf']);
    expect(getCommonExportTargets(['pdf', 'png'])).toEqual(['png', 'jpg', 'webp', 'svg']);
    expect(getCommonExportTargets(['pdf', 'svg'])).toEqual(['png', 'jpg', 'webp']);
  });

  it('validates individual conversion targets against the public matrix including PDF', () => {
    expect(isSupportedConversion('PNG', 'jpg')).toBe(true);
    expect(isSupportedConversion('PNG', 'pdf')).toBe(true);
    expect(isSupportedConversion('svg', 'PDF')).toBe(true);
    expect(isSupportedConversion('pdf', 'png')).toBe(true);
    expect(isSupportedConversion('pdf', 'svg')).toBe(true);
    expect(isSupportedConversion('bmp', 'pdf')).toBe(true);
    expect(isSupportedConversion('bmp', 'bmp')).toBe(false);
    expect(isSupportedConversion('pdf', 'pdf')).toBe(false);
    expect(isSupportedConversion('unknown', 'png')).toBe(false);
  });

  it('fails closed for empty or unknown source lists', () => {
    expect(getCommonExportTargets([])).toEqual([]);
    expect(getCommonExportTargets(['unknown'])).toEqual([]);
    expect(getCommonExportTargets(['png', 'unknown'])).toEqual([]);
  });

  it('exposes PDF output encoder while keeping unverified ICO output unexposed', () => {
    const targets = Object.values(SUPPORTED_FORMATS).flatMap((format) => format.canExportTo);
    expect(targets).toContain('pdf');
    expect(targets).not.toContain('ico');
  });

  it('does not treat Object.prototype properties as supported extensions', () => {
    expect(isSupportedSourceExtension('constructor')).toBe(false);
    expect(isSupportedSourceExtension('toString')).toBe(false);
    expect(isSupportedSourceExtension('valueOf')).toBe(false);
    expect(isSupportedConversion('constructor', 'png')).toBe(false);
    expect(isSupportedConversion('png', 'constructor')).toBe(false);
    expect(getCommonExportTargets(['constructor'])).toEqual([]);
  });
});

describe('universal default export targets', () => {
  it.each([
    ['png', 'jpg'],
    ['jpg', 'png'],
    ['jpeg', 'png'],
    ['webp', 'png'],
    ['bmp', 'png'],
    ['svg', 'png'],
    ['pdf', 'png'],
    ['PNG', 'jpg'],
    ['SVG', 'png'],
    ['PDF', 'png'],
  ])('chooses the declared default for %s', (sourceExt, expectedTarget) => {
    expect(getDefaultExportTarget(sourceExt)).toBe(expectedTarget);
  });

  it.each(['', 'unknown', 'ico', 'constructor', 'toString', 'valueOf', '__proto__'])(
    'returns no default for undeclared source %j',
    (sourceExt) => {
      expect(getDefaultExportTarget(sourceExt)).toBeUndefined();
    },
  );

  it.each([
    { targets: [] },
    { targets: [''] },
    { targets: ['ico', 'jpg'] },
    { targets: ['constructor', 'jpg'] },
    { targets: ['toString', 'jpg'] },
    { targets: ['__proto__', 'jpg'] },
  ])('rejects invalid first targets instead of inventing a fallback: $targets', ({ targets }) => {
    const originalTargets = SUPPORTED_FORMATS.png.canExportTo;
    try {
      SUPPORTED_FORMATS.png.canExportTo = targets;
      expect(getDefaultExportTarget('png')).toBeUndefined();
    } finally {
      SUPPORTED_FORMATS.png.canExportTo = originalTargets;
    }
  });

  it('requires the chosen target to have its own registry entry', () => {
    const originalPng = SUPPORTED_FORMATS.png;
    try {
      delete SUPPORTED_FORMATS.png;
      expect(getDefaultExportTarget('svg')).toBeUndefined();
    } finally {
      SUPPORTED_FORMATS.png = originalPng;
    }
  });

  it('gives every registered source a usable declared default and export matrix', () => {
    for (const [sourceExt, spec] of Object.entries(SUPPORTED_FORMATS)) {
      const defaultTarget = getDefaultExportTarget(sourceExt);
      expect(spec.ext).toBe(sourceExt);
      expect(defaultTarget).toBeDefined();
      expect(spec.canExportTo).toContain(defaultTarget);
      for (const targetExt of spec.canExportTo) {
        expect(isSupportedSourceExtension(targetExt)).toBe(true);
        expect(isSupportedConversion(sourceExt, targetExt)).toBe(true);
      }
    }
  });
});
