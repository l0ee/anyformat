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
      naturalWidth = 16384;
      naturalHeight = 8192;
      width = 16384;
      height = 8192;
      set src(_val: string) {
        setTimeout(() => this.onload(), 0);
      }
    });

    const file = new File(['huge'], 'huge.png', { type: 'image/png' });
    await convertUniversalFile(file, 'jpg');

    expect(allocatedWidth).toBeLessThanOrEqual(8192);
    expect(allocatedHeight).toBeLessThanOrEqual(8192);
    expect(allocatedWidth * allocatedHeight).toBeLessThanOrEqual(16777216);
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
});
