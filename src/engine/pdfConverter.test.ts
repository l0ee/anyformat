import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertImageToPdf, convertPdfToImage, convertPdfToSvg, convertSvgToPdf } from './pdfConverter';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 100, height: 100 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
    }),
  }),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: async () => ({
      embedPng: async () => ({ width: 100, height: 100 }),
      embedJpg: async () => ({ width: 100, height: 100 }),
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
});
