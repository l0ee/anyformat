import { describe, expect, it } from 'vitest';
import { traceColorFromImageData } from './colorTracer';

function createMockImageData(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = pixelFn(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('colorTracer', () => {
  it('preserves semi-transparency in palette and applies fill-opacity in SVG layers', () => {
    // 20x20 image:
    // Left half: red with alpha 128 (semi-transparent)
    // Right half: blue with alpha 255 (opaque)
    const img = createMockImageData(20, 20, (x) => {
      if (x < 10) return [255, 0, 0, 128];
      return [0, 0, 255, 255];
    });

    const result = traceColorFromImageData(img, { numberOfColors: 2 });
    expect(result.colors).toHaveLength(2);

    const redColor = result.colors?.find((c) => c.r > 200);
    expect(redColor).toBeDefined();
    // Alpha should reflect the semi-transparent pixels (around 128)
    expect(redColor!.a).toBeCloseTo(128, -1);
    expect(redColor!.a).toBeLessThan(255);

    // SVG should contain fill-opacity for the semi-transparent layer
    expect(result.svg).toMatch(/fill-opacity="0\.\d+"/);
  });

  it('applies blur when blurRadius is specified', () => {
    // A single high-contrast noise pixel in the center
    const img = createMockImageData(10, 10, (x, y) => {
      if (x === 5 && y === 5) return [255, 255, 255, 255];
      return [0, 0, 0, 255];
    });

    const withoutBlur = traceColorFromImageData(img, { numberOfColors: 2, blurRadius: 0, turdSize: 0 });
    const withBlur = traceColorFromImageData(img, { numberOfColors: 2, blurRadius: 2, turdSize: 0 });

    // With blur radius 2, the single isolated pixel is smoothed into the background
    expect(withBlur.pathCount).toBeLessThanOrEqual(withoutBlur.pathCount);
  });

  it('adds stroke-width and stroke to SVG layers when strokeWidth is specified', () => {
    const img = createMockImageData(20, 20, (x) => {
      if (x < 10) return [255, 0, 0, 255];
      return [0, 0, 255, 255];
    });

    const result = traceColorFromImageData(img, { numberOfColors: 2, strokeWidth: 2 });
    expect(result.svg).toContain('stroke-width="2"');
  });

  it('clusters pixels based on both color and opacity (4D RGBA)', () => {
    // Left half: green with alpha 80
    // Right half: green with alpha 255
    const img = createMockImageData(20, 20, (x) => {
      if (x < 10) return [0, 200, 0, 80];
      return [0, 200, 0, 255];
    });

    const result = traceColorFromImageData(img, { numberOfColors: 2 });
    expect(result.colors).toHaveLength(2);
    const alphas = result.colors!.map(c => c.a).sort((a, b) => a - b);
    expect(alphas[0]).toBeLessThan(150);
    expect(alphas[1]).toBeGreaterThan(200);
  });
});

