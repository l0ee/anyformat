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

    expect(convertPdfToImage).toHaveBeenCalledWith(file, 'png');
    expect(result.mimeType).toBe('image/png');
    expect(result.filename).toBe('doc.png');
  });

  it('dispatches PDF source conversion to SVG (pdf -> svg)', async () => {
    const file = new File(['pdf_data'], 'doc.pdf', { type: 'application/pdf' });
    const result = await convertUniversalFile(file, 'svg');

    expect(convertPdfToSvg).toHaveBeenCalledWith(file);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.filename).toBe('doc.svg');
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
});
