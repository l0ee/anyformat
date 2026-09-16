import { describe, expect, it } from 'vitest';
import { optimizeSvg } from './svgOptimizer';

describe('optimizeSvg', () => {
  const source = `<?xml version="1.0"?>
    <!-- remove me -->
    <svg xmlns="http://www.w3.org/2000/svg">
      <title>Example</title><desc>Description</desc><metadata>metadata</metadata>
      <path id="" stroke="#ff0000" stroke-width="1" d="M 0.126, -2.555 L 10.000 20.999" />
    </svg>`;

  it('applies the documented cleanup operations', () => {
    const result = optimizeSvg(source, { precision: 2, minify: true });

    expect(result.svg).not.toContain('<?xml');
    expect(result.svg).not.toContain('remove me');
    expect(result.svg).not.toContain('<metadata>');
    expect(result.svg).not.toContain('<title>');
    expect(result.svg).not.toContain('<desc>');
    expect(result.svg).toContain('stroke="#f00"');
    expect(result.svg).toContain('d="M0.13, -2.56L10 21"');
    expect(result.svg).not.toContain('stroke-width="1"');
    expect(result.optimizedSize).toBeLessThan(result.originalSize);
    expect(result.savingsPercentage).toBeGreaterThan(0);
  });

  it('preserves optional content when cleanup options are disabled', () => {
    const result = optimizeSvg(source, {
      removeComments: false,
      removeMetadata: false,
      removeTitle: false,
      convertColors: false,
      minify: false,
      precision: -1,
    });

    expect(result.svg).toContain('remove me');
    expect(result.svg).toContain('<metadata>');
    expect(result.svg).toContain('<title>');
    expect(result.svg).toContain('#ff0000');
    expect(result.svg).toContain('0.126');
  });

  it('handles empty SVG input without invalid savings values', () => {
    const result = optimizeSvg('');
    expect(result.originalSize).toBe(0);
    expect(result.optimizedSize).toBe(0);
    expect(result.savingsPercentage).toBe(0);
  });
});
