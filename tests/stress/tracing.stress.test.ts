import { describe, expect, it } from 'vitest';
import { quadrantImage } from '../../test/fixtures/quadrantImage';
import { traceColorFromImageData } from '../../src/engine/colorTracer';
import { traceMonochromeFromImageData } from '../../src/engine/monochromeTracer';

// Run with npm run test:stress; regular unit runs discover but skip these cases.
describe.skipIf(process.env.RUN_STRESS_TESTS !== '1')('full-resolution 4K tracing', () => {
  it.each(['monochrome', 'color'] as const)('preserves dimensions and finite path output for %s', (mode) => {
    const image = quadrantImage(3840, 2160);
    const result = mode === 'monochrome'
      ? traceMonochromeFromImageData(image, { threshold: 128 })
      : traceColorFromImageData(image, { numberOfColors: 4 }, image.width, image.height);
    expect(result.width).toBe(3840);
    expect(result.height).toBe(2160);
    expect(result.pathCount).toBeGreaterThan(0);
    expect(result.svg).toContain('viewBox="0 0 3840 2160"');
    expect(result.svg).toContain('width="3840" height="2160"');
    expect(result.svg).toContain('data-author="l0ee"');
    expect(result.svg).not.toMatch(/NaN|Infinity/);
  }, 60_000);
});
