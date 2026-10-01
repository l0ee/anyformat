import { describe, expect, it } from 'vitest';
import { quadrantImage } from '../../test/fixtures/quadrantImage';
import { traceColor } from './colorTracer';
import { traceMonochrome } from './monochromeTracer';
import { extractPalette } from './paletteExtractor';
import { optimizeSvg } from './svgOptimizer';

describe('synthetic image tracing workflow', () => {
  it('produces usable monochrome/color SVGs and preserves creator attribution during cleanup', async () => {
    const image = quadrantImage(200, 200);
    const monochrome = await traceMonochrome(image, { threshold: 128 });
    const color = await traceColor(image, { numberOfColors: 4 });
    for (const result of [monochrome, color]) {
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      expect(result.pathCount).toBeGreaterThan(0);
      expect(result.svg).toContain('viewBox="0 0 200 200"');
      const optimized = optimizeSvg(result.svg, { removeComments: true, removeMetadata: true, minify: true });
      expect(optimized.svg).toContain('data-author="l0ee"');
      expect(optimized.svg).toContain('Generator: AnyFormat');
      expect(optimized.svg).toContain('<path');
    }
    expect(color.colors).toHaveLength(4);
  });

  it('extracts the four source colors with balanced percentages', async () => {
    const palette = await extractPalette(quadrantImage(200, 200), 4);
    expect(new Set(palette.map((color) => color.hex))).toEqual(new Set(['#ff0000', '#0000ff', '#000000', '#ffffff']));
    for (const color of palette) {
      expect(color.a).toBe(255);
      expect(color.percentage).toBeCloseTo(25, 1);
    }
  });
});
