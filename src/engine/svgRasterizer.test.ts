import { afterEach, describe, expect, it, vi } from 'vitest';
import { rasterizeSvgToBlob, rasterizeSvgToDataUrl, svgToCanvas } from './svgRasterizer';

interface RasterizerMocks {
  canvas: HTMLCanvasElement;
  createCanvas: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
}

function installRasterizerMocks(
  rootAttributes: Record<string, string>,
  rootName = 'svg',
  canvasBlobType?: string,
  canvasDataUrlType?: string
): RasterizerMocks {
  const context = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D;

  const toBlob = vi.fn((callback: BlobCallback, mimeType?: string) => {
    callback(new Blob(['rasterized'], { type: canvasBlobType || mimeType || 'image/png' }));
  });
  const toDataURL = vi.fn((mimeType?: string) =>
    `data:${canvasDataUrlType || mimeType || 'image/png'};base64,AA==`,
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob,
    toDataURL,
  } as unknown as HTMLCanvasElement;
  const createCanvas = vi.fn(() => canvas);

  vi.stubGlobal('document', { createElement: createCanvas });
  vi.stubGlobal(
    'DOMParser',
    class MockDOMParser {
      parseFromString() {
        return {
          documentElement: {
            localName: rootName,
            namespaceURI: 'http://www.w3.org/2000/svg',
            getAttribute: (name: string) =>
              (Object.prototype.hasOwnProperty.call(rootAttributes, name) ? rootAttributes[name] : null)
          }
        };
      }
    }
  );
  vi.stubGlobal(
    'Image',
    class MockImage {
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-rasterizer-test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

  return { canvas, createCanvas, toBlob, toDataURL };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('svgToCanvas sizing', () => {
  it('uses dimensions from the root SVG element, not child geometry', async () => {
    const { canvas } = installRasterizerMocks({ width: '320', height: '160', viewBox: '0 0 320 160' });
    const source = '<svg width="320" height="160"><rect width="8" height="900" /></svg>';

    await svgToCanvas(source);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(160);
  });

  it.each([
    ['1in', '25.4mm'],
    ['2.54cm', '72pt'],
    ['6pc', '96px'],
    ['101.6q', '1in']
  ])('converts absolute root lengths %s and %s to CSS pixels', async (width, height) => {
    const { canvas } = installRasterizerMocks({ width, height });

    await svgToCanvas('<svg />');

    expect(canvas.width).toBe(96);
    expect(canvas.height).toBe(96);
  });

  it('uses the root viewBox as the dimension fallback and preserves its aspect ratio', async () => {
    const { canvas } = installRasterizerMocks({ viewBox: '25 -5, 640 480' });

    await svgToCanvas('<svg viewBox="25 -5, 640 480" />');

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });

  it('uses the viewBox ratio to derive a missing root dimension', async () => {
    const { canvas } = installRasterizerMocks({ width: '10cm', viewBox: '0 0 400 200' });

    await svgToCanvas('<svg width="10cm" viewBox="0 0 400 200" />');

    expect(canvas.width).toBe(378);
    expect(canvas.height).toBe(189);
  });

  it('resolves relative root lengths from a valid viewBox', async () => {
    const { canvas } = installRasterizerMocks({ width: '100%', height: '100%', viewBox: '0 0 300 150' });

    await svgToCanvas('<svg width="100%" height="100%" viewBox="0 0 300 150" />');

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
  });

  it('preserves the source aspect ratio when only one output dimension is specified', async () => {
    const { canvas } = installRasterizerMocks({ width: '400', height: '200' });

    await svgToCanvas('<svg />', { width: 200 });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  it('rejects invalid or unbounded dimensions before allocating a canvas', async () => {
    const { createCanvas } = installRasterizerMocks({ width: '0', height: '100' });

    await expect(svgToCanvas('<svg />')).rejects.toThrow(/positive and finite/i);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects relative dimensions when no viewBox can resolve them', async () => {
    const { createCanvas } = installRasterizerMocks({ width: '100%', height: '100%' });

    await expect(svgToCanvas('<svg />')).rejects.toThrow(/valid viewBox/i);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects an SVG without a valid root size or viewBox', async () => {
    const { createCanvas } = installRasterizerMocks({ width: '100' });

    await expect(svgToCanvas('<svg />')).rejects.toThrow(/height cannot be resolved/i);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects non-SVG document roots', async () => {
    const { createCanvas } = installRasterizerMocks({ width: '100', height: '100' }, 'html');

    await expect(svgToCanvas('<html />')).rejects.toThrow(/root must be an <svg>/i);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('clamps output to both the canvas edge and pixel budgets before allocation', async () => {
    const { canvas } = installRasterizerMocks({ width: '16384', height: '8192' });

    await svgToCanvas('<svg />');

    expect(canvas.width).toBeLessThanOrEqual(8_192);
    expect(canvas.height).toBeLessThanOrEqual(8_192);
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(16_777_216);
    expect(canvas.width / canvas.height).toBeCloseTo(2, 3);
  });

  it('clamps extremely wide output to the edge limit and a nonzero height', async () => {
    const { canvas } = installRasterizerMocks({ width: '1000000000000px', height: '1px' });

    await svgToCanvas('<svg />');

    expect(canvas.width).toBe(8_192);
    expect(canvas.height).toBe(1);
  });

  it('rejects invalid scale and output dimensions before allocating a canvas', async () => {
    const { createCanvas } = installRasterizerMocks({ width: '100', height: '50' });

    await expect(svgToCanvas('<svg />', { scale: Number.POSITIVE_INFINITY })).rejects.toThrow(/scale/i);
    await expect(svgToCanvas('<svg />', { width: 0 })).rejects.toThrow(/Output width/i);
    expect(createCanvas).not.toHaveBeenCalled();
  });
});

describe('SVG raster blob encoding', () => {
  it('rejects a canvas fallback whose actual MIME does not match the requested format', async () => {
    const { toBlob } = installRasterizerMocks({ width: '20', height: '10' }, 'svg', 'image/png');

    await expect(rasterizeSvgToBlob('<svg width="20" height="10" />', { format: 'webp' })).rejects.toThrow(
      'Browser returned image/png instead of image/webp.',
    );
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.92);
  });

  it('rejects a PNG data URL fallback when JPEG was requested', async () => {
    const { toDataURL } = installRasterizerMocks({ width: '20', height: '10' }, 'svg', undefined, 'image/png');

    await expect(rasterizeSvgToDataUrl('<svg width="20" height="10" />', { format: 'jpeg' })).rejects.toThrow(
      'Browser returned image/png instead of image/jpeg.',
    );
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
  });
});
