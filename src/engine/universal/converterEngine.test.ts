import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertUniversalFile } from './converterEngine';

vi.mock('../pdfConverter', () => ({
  convertPdfToImage: vi.fn().mockResolvedValue(new Blob(['pdf_to_img'], { type: 'image/png' })),
  convertPdfToSvg: vi.fn().mockResolvedValue(new Blob(['<svg>pdf</svg>'], { type: 'image/svg+xml' })),
  convertImageToPdf: vi.fn().mockResolvedValue(new Blob(['img_to_pdf'], { type: 'application/pdf' })),
  convertSvgToPdf: vi.fn().mockResolvedValue(new Blob(['svg_to_pdf'], { type: 'application/pdf' })),
}));

vi.mock('../../workers/traceWorkerClient', () => ({
  traceWorkerClient: {
    traceColor: async () => ({ svg: '<svg></svg>' }),
  },
}));

vi.mock('../svgOptimizer', () => ({
  optimizeSvg: () => ({ svg: '<svg></svg>' }),
}));

vi.mock('../svgRasterizer', () => ({
  rasterizeSvgToBlob: async () => new Blob(['fake_png'], { type: 'image/png' }),
}));

import {
  convertImageToPdf,
  convertPdfToImage,
  convertPdfToSvg,
  convertSvgToPdf,
} from '../pdfConverter';

describe('converterEngine with PDF support', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
        callback(new Blob(['fake_img_data'], { type: mimeType || 'image/png' }));
      },
    };

    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {};
      },
    });

    vi.stubGlobal('Image', class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      naturalWidth = 100;
      naturalHeight = 100;
      width = 100;
      height = 100;
      set src(_val: string) {
        setTimeout(() => this.onload(), 0);
      }
    });

    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => {},
    });
  });

  it('dispatches PDF source conversion to image (pdf -> png)', async () => {
    const file = new File(['pdf_data'], 'doc.pdf', { type: 'application/pdf' });
    const result = await convertUniversalFile(file, 'png');

    expect(convertPdfToImage).toHaveBeenCalledWith(file, 'png', 1);
    expect(result.mimeType).toBe('image/png');
    expect(result.filename).toBe('doc.png');
  });

  it('dispatches PDF source conversion to SVG (pdf -> svg)', async () => {
    const file = new File(['pdf_data'], 'doc.pdf', { type: 'application/pdf' });
    const result = await convertUniversalFile(file, 'svg');

    expect(convertPdfToSvg).toHaveBeenCalledWith(file, 1, { signal: undefined, onStage: expect.any(Function) });
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.filename).toBe('doc.svg');
  });

  it('dispatches PDF source conversion with selected page number', async () => {
    const file = new File(['pdf_data'], 'doc.pdf', { type: 'application/pdf' });
    const result = await convertUniversalFile(file, 'png', undefined, { pageNumber: 3 });

    expect(convertPdfToImage).toHaveBeenCalledWith(file, 'png', 3);
    expect(result.mimeType).toBe('image/png');
    expect(result.filename).toBe('doc_p3.png');
  });

  it('dispatches raster source conversion to PDF (png -> pdf)', async () => {
    const file = new File(['png_data'], 'image.png', { type: 'image/png' });
    const result = await convertUniversalFile(file, 'pdf');

    expect(convertImageToPdf).toHaveBeenCalledWith(file);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toBe('image.pdf');
  });

  it('dispatches SVG source conversion to PDF (svg -> pdf)', async () => {
    const file = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });
    const result = await convertUniversalFile(file, 'pdf');

    expect(convertSvgToPdf).toHaveBeenCalledWith('<svg></svg>');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toBe('vector.pdf');
  });

  it('clamps huge raster image dimensions to canvas limits during raster-to-raster conversion', async () => {
    let allocatedWidth = 0;
    let allocatedHeight = 0;
    let encodedWidth = 0;
    let encodedHeight = 0;

    const mockCanvas = {
      set width(val: number) { allocatedWidth = val; },
      get width() { return allocatedWidth; },
      set height(val: number) { allocatedHeight = val; },
      get height() { return allocatedHeight; },
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
        encodedWidth = allocatedWidth;
        encodedHeight = allocatedHeight;
        callback(new Blob(['data'], { type: mimeType || 'image/png' }));
      },
    };

    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      },
    });

    vi.stubGlobal('Image', class {
      onload: () => void = () => {};
      naturalWidth = 8192;
      naturalHeight = 4096;
      width = 8192;
      height = 4096;
      set src(_val: string) {
        setTimeout(() => this.onload(), 0);
      }
    });

    const file = new File(['huge'], 'huge.png', { type: 'image/png' });
    const result = await convertUniversalFile(file, 'jpg');

    expect(encodedWidth).toBeGreaterThan(0);
    expect(encodedHeight).toBeGreaterThan(0);
    expect(encodedWidth).toBeLessThanOrEqual(8192);
    expect(encodedHeight).toBeLessThanOrEqual(8192);
    expect(encodedWidth * encodedHeight).toBeLessThanOrEqual(16777216);
    expect(result.imageOutput).toEqual({ width: encodedWidth, height: encodedHeight, limited: true });
    expect(allocatedWidth).toBe(0);
    expect(allocatedHeight).toBe(0);
  });

  it('rejects an oversized raster header before assigning Image.src', async () => {
    let startedDecoding = false;
    vi.stubGlobal('Image', class {
      onload: () => void = () => {};
      naturalWidth = 10;
      naturalHeight = 10;
      set src(_value: string) {
        startedDecoding = true;
        queueMicrotask(() => this.onload());
      }
    });
    const bytes = new Uint8Array(24);
    const header = new DataView(bytes.buffer);
    header.setUint32(0, 0x89504e47);
    header.setUint32(4, 0x0d0a1a0a);
    header.setUint32(16, 20000);
    header.setUint32(20, 20000);
    await expect(convertUniversalFile(new File([bytes], 'oversized.png', { type: 'image/png' }), 'jpg')).rejects.toThrow(/exceed maximum allowable size/);
    expect(startedDecoding).toBe(false);
  });

  it('rejects conversion when the browser returns a mismatched MIME type (e.g. unsupported WebP)', async () => {
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        // Browser does not support WebP, falls back to image/png
        callback(new Blob(['png_fallback'], { type: 'image/png' }));
      },
    };

    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      },
    });

    const file = new File(['data'], 'test.png', { type: 'image/png' });
    await expect(convertUniversalFile(file, 'webp')).rejects.toThrow(/Browser returned image\/png instead of requested image\/webp/);
  });

  it.each(['draw', 'encode'])('rejects a canvas %s exception instead of hanging', async (stage) => {
    const fail = () => { throw new Error(`Canvas ${stage} failed`); };
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: stage === 'draw' ? fail : vi.fn() }),
        toBlob: fail,
      }),
    });
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await expect(convertUniversalFile(file, 'png')).rejects.toThrow(`Canvas ${stage} failed`);
  });

  it('does not start conversion when its signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const onStage = vi.fn();
    await expect(convertUniversalFile(new File(['data'], 'photo.png'), 'pdf', undefined, { signal: controller.signal, onStage })).rejects.toMatchObject({ name: 'AbortError' });
    expect(convertImageToPdf).not.toHaveBeenCalled();
    expect(onStage).not.toHaveBeenCalled();
  });

  it('discards a PDF result that finishes after stopping', async () => {
    const controller = new AbortController();
    let finish!: (blob: Blob) => void;
    vi.mocked(convertImageToPdf).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const stages: string[] = [];
    const request = convertUniversalFile(new File(['data'], 'photo.png'), 'pdf', undefined, { signal: controller.signal, onStage: (stage) => stages.push(stage) });
    controller.abort();
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    finish(new Blob(['late'], { type: 'application/pdf' }));
    await rejection;
    expect(stages).toEqual(['Reading file…', 'Preparing PDF…']);
  });

  it('reports raster stages without claiming measured time progress', async () => {
    const stages: string[] = [];
    await convertUniversalFile(new File(['data'], 'photo.jpg'), 'png', undefined, { onStage: (stage) => stages.push(stage) });
    expect(stages).toEqual(['Reading file…', 'Reading image…', 'Preparing download…']);
  });

  it('discards a stopped raster export with image settings and releases its resources', async () => {
    const controller = new AbortController();
    let finish!: (blob: Blob | null) => void;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => { finish = callback; }),
    };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:stopped', revokeObjectURL });
    vi.stubGlobal('document', { createElement: () => canvas });
    const onProgress = vi.fn();
    const request = convertUniversalFile(new File(['data'], 'photo.jpg'), 'png', onProgress,
      { image: { width: 50 }, signal: controller.signal });
    await vi.waitFor(() => expect(canvas.toBlob).toHaveBeenCalled());
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(50);
    controller.abort();
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    finish(new Blob(['late'], { type: 'image/png' }));
    await rejection;
    expect(onProgress).not.toHaveBeenCalledWith(100);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:stopped');
  });

  it.each(['context', 'draw', 'encode', 'empty', 'mime'])('releases resources after canvas %s failure', async (stage) => {
    const fail = () => { throw new Error(`Canvas ${stage} failed`); };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => stage === 'context' ? null : { drawImage: stage === 'draw' ? fail : vi.fn() },
      toBlob: stage === 'encode' ? fail : (callback: (blob: Blob | null) => void) => callback(stage === 'empty' ? null : new Blob(['wrong'], { type: 'image/jpeg' })),
    };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:failure', revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: () => canvas,
    });
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await expect(convertUniversalFile(file, 'png')).rejects.toThrow();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:failure');
  });

  it('rejects invalid export settings before allocating an image URL', async () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    await expect(convertUniversalFile(new File(['data'], 'test.png'), 'jpg', undefined, { image: { width: 0 } })).rejects.toThrow(/Width/);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it.each(['jpg', 'webp', 'png'])('passes applicable quality and dimensions to the %s encoder', async (target) => {
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const toBlob = vi.fn((callback: (blob: Blob | null) => void, mime: string) => callback(new Blob(['image'], { type: mime })));
    const canvas = { width: 0, height: 0, getContext: () => context, toBlob };
    vi.stubGlobal('document', { createElement: () => canvas });
    const result = await convertUniversalFile(new File(['data'], 'test.png'), target, undefined,
      { image: { width: 50, quality: 0.75, background: '#ff0000' } });
    expect(result.imageOutput).toEqual({ width: 50, height: 50, limited: false });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), target === 'jpg' ? 'image/jpeg' : `image/${target}`, target === 'png' ? undefined : 0.75);
    expect(context.fillRect).toHaveBeenCalledTimes(target === 'jpg' ? 1 : 0);
    if (target === 'jpg') expect(context.fillStyle).toBe('#ff0000');
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('releases the source URL when decoding fails', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:decode', revokeObjectURL });
    vi.stubGlobal('Image', class {
      onerror: () => void = () => {};
      set src(_value: string) { queueMicrotask(() => this.onerror()); }
    });
    await expect(convertUniversalFile(new File(['data'], 'test.png'), 'jpg')).rejects.toThrow('Failed to load image file');
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:decode');
  });
});
