import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  convertImageToPdf,
  convertPdfToImage,
  convertPdfToSvg,
  convertSvgToPdf,
  getPdfPageCount,
} from './pdfConverter';

let mockViewportDimensions = { width: 100, height: 100 };
let mockEmbeddedDimensions = { width: 100, height: 100 };

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      destroy: vi.fn(),
      getPage: () =>
        Promise.resolve({
          getViewport: ({ scale = 1.0 }: { scale?: number } = {}) => ({
            width: mockViewportDimensions.width * scale,
            height: mockViewportDimensions.height * scale,
          }),
          render: () => ({ promise: Promise.resolve() }),
        }),
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: async () => ({
      setTitle: vi.fn(),
      setAuthor: vi.fn(),
      setCreator: vi.fn(),
      setProducer: vi.fn(),
      setCreationDate: vi.fn(),
      setModificationDate: vi.fn(),
      embedPng: async () => ({ width: mockEmbeddedDimensions.width, height: mockEmbeddedDimensions.height }),
      embedJpg: async () => ({ width: mockEmbeddedDimensions.width, height: mockEmbeddedDimensions.height }),
      addPage: () => ({
        drawImage: vi.fn(),
      }),
      save: async () => new Uint8Array([37, 80, 68, 70]), // %PDF
    }),
  },
}));

vi.mock('../workers/traceWorkerClient', () => ({
  traceWorkerClient: {
    traceColor: async () => ({ svg: '<svg></svg>' }),
  },
}));

vi.mock('./svgRasterizer', () => ({
  rasterizeSvgToBlob: async () => new Blob(['fake_png'], { type: 'image/png' }),
}));

describe('pdfConverter', () => {
  beforeEach(() => {
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
  });

  it('converts SVG content to PDF blob', async () => {
    const pdfBlob = await convertSvgToPdf('<svg></svg>');
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe('application/pdf');
  });

  it('converts image file to PDF blob', async () => {
    const file = new File(['fake_img'], 'test.png', { type: 'image/png' });
    const pdfBlob = await convertImageToPdf(file);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe('application/pdf');
  });

  it('rejects image file to PDF conversion when decoded image exceeds canvas budget', async () => {
    mockEmbeddedDimensions = { width: 10000, height: 10000 };
    const file = new File(['fake_img'], 'huge.png', { type: 'image/png' });
    await expect(convertImageToPdf(file)).rejects.toThrow(
      /Image for PDF exceeds the browser canvas limits/
    );
    mockEmbeddedDimensions = { width: 100, height: 100 };
  });

  it('converts PDF to image', async () => {
    const mockFile = new File(['fake_pdf'], 'test.pdf', { type: 'application/pdf' });
    const imageBlob = await convertPdfToImage(mockFile, 'png', 1);
    expect(imageBlob).toBeInstanceOf(Blob);
  });

  it('converts PDF to SVG', async () => {
    const mockFile = new File(['fake_pdf'], 'test.pdf', { type: 'application/pdf' });
    const svgBlob = await convertPdfToSvg(mockFile, 1);
    expect(svgBlob).toBeInstanceOf(Blob);
    expect(svgBlob.type).toBe('image/svg+xml');
  });

  it('retrieves PDF total page count', async () => {
    const mockFile = new File(['fake_pdf'], 'test.pdf', { type: 'application/pdf' });
    const count = await getPdfPageCount(mockFile);
    expect(count).toBe(1);
  });

  it('rejects when browser canvas returns a fallback MIME type for WebP', async () => {
    const mockFile = new File(['fake_pdf'], 'test.pdf', { type: 'application/pdf' });
    // Override canvas.toBlob to simulate browser fallback to image/png
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ fillStyle: '', fillRect: vi.fn() }),
        toBlob: (callback: (b: Blob) => void) => {
          callback(new Blob(['png_bytes'], { type: 'image/png' }));
        },
      }),
    });

    await expect(convertPdfToImage(mockFile, 'webp', 1)).rejects.toThrow(
      /Browser does not support exporting PDF to webp/
    );
  });

  it('adaptively downscales large PDF pages without rejecting them before scaling', async () => {
    mockViewportDimensions = { width: 10000, height: 10000 };
    const mockFile = new File(['fake_pdf'], 'large.pdf', { type: 'application/pdf' });
    const imageBlob = await convertPdfToImage(mockFile, 'png', 1);
    expect(imageBlob).toBeInstanceOf(Blob);
    mockViewportDimensions = { width: 100, height: 100 };
  });

  it('adaptively downscales extremely large PDF pages below 0.01 scale without exceeding canvas budget', async () => {
    mockViewportDimensions = { width: 1_000_000, height: 1_000_000 };
    const mockFile = new File(['fake_pdf'], 'huge.pdf', { type: 'application/pdf' });
    const imageBlob = await convertPdfToImage(mockFile, 'png', 1);
    expect(imageBlob).toBeInstanceOf(Blob);
    mockViewportDimensions = { width: 100, height: 100 };
  });
});
