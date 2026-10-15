import { describe, expect, it } from 'vitest';
import { calculateOutputDimensions } from './imageTransform';
import { isSupportedConversion } from './types';

describe('image export sizing', () => {
  it('fits within a box while preserving aspect ratio', () => {
    expect(calculateOutputDimensions(4000, 3000, { width: 1600, height: 1600 })).toEqual({ width: 1600, height: 1200, limited: false });
  });
  it('supports one dimension and prevents unrequested upscaling', () => {
    expect(calculateOutputDimensions(400, 300, { width: 800 }).width).toBe(400);
    expect(calculateOutputDimensions(400, 300, { width: 800, allowUpscaling: true })).toEqual({ width: 800, height: 600, limited: false });
    expect(calculateOutputDimensions(400, 300, { height: 150 }).width).toBe(200);
  });
  it('allows independent dimensions when unlocked', () => {
    expect(calculateOutputDimensions(400, 300, { width: 100, height: 100, keepAspectRatio: false })).toEqual({ width: 100, height: 100, limited: false });
  });
  it('enforces edge and pixel budgets after resizing', () => {
    const result = calculateOutputDimensions(10000, 10000);
    expect(result.width * result.height).toBeLessThanOrEqual(16777216);
    expect(result.limited).toBe(true);
    expect(calculateOutputDimensions(20000, 100).width).toBeLessThanOrEqual(8192);
  });
  it.each(['width', 'height'] as const)('preserves requested %s despite floating-point scaling', (dimension) => {
    for (const size of [29, 57, 58]) {
      expect(calculateOutputDimensions(100, 100, { [dimension]: size })).toEqual({ width: size, height: size, limited: false });
    }
  });
  it('rounds proportional dimensions to whole pixels while fitting the requested box', () => {
    expect(calculateOutputDimensions(100, 75, { width: 29, height: 29 })).toEqual({ width: 29, height: 22, limited: false });
    expect(calculateOutputDimensions(75, 100, { width: 29, height: 29 })).toEqual({ width: 22, height: 29, limited: false });
  });
  it.each([[8191, 2051], [16384, 1], [1, 16384]])('keeps rounded %i × %i outputs inside both canvas budgets', (width, height) => {
    const result = calculateOutputDimensions(width, height);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
    expect(result.width).toBeLessThanOrEqual(8192);
    expect(result.height).toBeLessThanOrEqual(8192);
    expect(result.width * result.height).toBeLessThanOrEqual(16777216);
    expect(result.limited).toBe(true);
  });
  it.each([{ width: 0 }, { height: -1 }, { width: NaN }, { width: 1.5 }, { quality: Infinity }, { quality: 1.1 }, { background: 'red' }])('rejects invalid settings %j', (options) => {
    expect(() => calculateOutputDimensions(400, 300, options)).toThrow();
  });
  it('allows same-format exports and JPEG alias input', () => {
    for (const ext of ['png', 'jpg', 'webp']) expect(isSupportedConversion(ext, ext)).toBe(true);
    expect(isSupportedConversion('jpeg', 'jpg')).toBe(true);
  });
});
