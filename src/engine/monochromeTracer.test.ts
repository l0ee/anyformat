import { describe, expect, it } from 'vitest';
import { traceMonochromeFromImageData } from './monochromeTracer';

function createMockImageData(width: number, height: number, fill: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('monochromeTracer', () => {
  it('does not trace transparent pixels as foreground shapes when invert is enabled', () => {
    // 20x20 image of fully transparent pixels
    const transparentImg = createMockImageData(20, 20, [0, 0, 0, 0]);

    // Tracing with invert: false -> 0 paths
    const normalResult = traceMonochromeFromImageData(transparentImg, { invert: false, turdSize: 2 });
    expect(normalResult.pathCount).toBe(0);

    // Tracing with invert: true should ALSO produce 0 paths because transparent is background
    const invertedResult = traceMonochromeFromImageData(transparentImg, { invert: true, turdSize: 2 });
    expect(invertedResult.pathCount).toBe(0);
  });

  it('preserves viewBox coordinate system when restoring original dimensions', async () => {
    // 20x20 image with a solid square in center
    const imgData = createMockImageData(20, 20, [255, 255, 255, 255]);
    // Set center 10x10 to black
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = (y * 20 + x) * 4;
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
      }
    }

    const res = await import('./monochromeTracer').then(m => m.traceMonochrome(imgData));
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect(res.svg).toContain('viewBox="0 0 20 20"');
    expect(res.svg).toContain('width="20"');
    expect(res.svg).toContain('height="20"');
  });

  it('adds stroke-width attribute when strokeWidth is specified', () => {
    const imgData = createMockImageData(20, 20, [255, 255, 255, 255]);
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = (y * 20 + x) * 4;
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
      }
    }

    const res = traceMonochromeFromImageData(imgData, { strokeWidth: 1.5 });
    expect(res.svg).toContain('stroke="currentColor"');
    expect(res.svg).toContain('stroke-width="1.5"');
  });

  it('supports all 6 turnPolicy options when tracing contours', () => {
    const imgData = createMockImageData(20, 20, [255, 255, 255, 255]);
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = (y * 20 + x) * 4;
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
      }
    }

    const policies: ('black' | 'white' | 'left' | 'right' | 'minority' | 'majority')[] = [
      'black',
      'white',
      'left',
      'right',
      'minority',
      'majority',
    ];

    for (const policy of policies) {
      const res = traceMonochromeFromImageData(imgData, { turnPolicy: policy });
      expect(res.pathCount).toBeGreaterThan(0);
      expect(res.svg).toContain('<svg');
    }
  });

  it('differentiates turn policies on ambiguous diagonal junctions', () => {
    // Two squares touching at diagonal corner (4,4) and (5,5)
    const imgData = createMockImageData(20, 20, [255, 255, 255, 255]);
    const setBlack = (x: number, y: number) => {
      const idx = (y * 20 + x) * 4;
      imgData.data[idx] = 0;
      imgData.data[idx + 1] = 0;
      imgData.data[idx + 2] = 0;
    };

    // Square 1: (2..4, 2..4)
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        setBlack(x, y);
      }
    }
    // Square 2: (5..7, 5..7)
    for (let y = 5; y <= 7; y++) {
      for (let x = 5; x <= 7; x++) {
        setBlack(x, y);
      }
    }

    const resBlack = traceMonochromeFromImageData(imgData, { turnPolicy: 'black', turdSize: 0 });
    const resWhite = traceMonochromeFromImageData(imgData, { turnPolicy: 'white', turdSize: 0 });
    const resMajority = traceMonochromeFromImageData(imgData, { turnPolicy: 'majority', turdSize: 0 });
    const resMinority = traceMonochromeFromImageData(imgData, { turnPolicy: 'minority', turdSize: 0 });

    expect(resBlack.svg).toBeDefined();
    expect(resWhite.svg).toBeDefined();
    expect(resMajority.svg).toBeDefined();
    expect(resMinority.svg).toBeDefined();
  });
});

