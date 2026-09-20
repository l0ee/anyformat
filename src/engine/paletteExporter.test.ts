import { describe, expect, it } from 'vitest';
import { exportPaletteAsCss, exportPaletteAsJson, parsePaletteFromJson } from './paletteExporter';
import { PaletteColor } from './types';

describe('paletteExporter', () => {
  const samplePalette: PaletteColor[] = [
    { r: 255, g: 0, b: 0, a: 1, hex: '#ff0000', percentage: 50 },
    { r: 0, g: 255, b: 0, a: 1, hex: '#00ff00', percentage: 50 },
  ];

  it('exports CSS variables correctly', () => {
    const css = exportPaletteAsCss(samplePalette);
    expect(css).toContain('--color-1: #ff0000;');
    expect(css).toContain('--color-2: #00ff00;');
  });

  it('exports and parses JSON correctly', () => {
    const json = exportPaletteAsJson(samplePalette);
    const parsed = parsePaletteFromJson(json);
    expect(parsed).toEqual(samplePalette);
  });
});
