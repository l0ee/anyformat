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

const { mockEmbedPng, mockEmbedJpg } = vi.hoisted(() => ({
  mockEmbedPng: vi.fn(),
  mockEmbedJpg: vi.fn(),
}));

function pngBytes(width = 100, height = 100) {
  const bytes = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=',
    'base64',
  ));
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

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
      embedPng: mockEmbedPng,
      embedJpg: mockEmbedJpg,
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
  rasterizeSvgToBlob: async () => new Blob([pngBytes()], { type: 'image/png' }),
}));

describe('pdfConverter', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { href: 'http://localhost/' } });
    mockEmbeddedDimensions = { width: 100, height: 100 };
    mockEmbedPng.mockReset().mockImplementation(async () => ({ ...mockEmbeddedDimensions }));
    mockEmbedJpg.mockReset().mockImplementation(async () => ({ ...mockEmbeddedDimensions }));
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
        callback(new Blob([pngBytes()], { type: mimeType || 'image/png' }));
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
    const file = new File([pngBytes()], 'test.png', { type: 'image/png' });
    const pdfBlob = await convertImageToPdf(file);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe('application/pdf');
    expect(mockEmbedPng).toHaveBeenCalledOnce();
  });

  it('rejects oversized GIF headers before image decoding or PDF embedding', async () => {
    const imageConstructor = vi.fn();
    vi.stubGlobal('Image', imageConstructor);
    const bytes = new Uint8Array(10);
    bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 20000, true);
    view.setUint16(8, 20000, true);
    await expect(convertImageToPdf(new Blob([bytes], { type: 'image/gif' }))).rejects.toThrow(/exceed maximum allowable size/);
    expect(imageConstructor).not.toHaveBeenCalled();
    expect(mockEmbedPng).not.toHaveBeenCalled();
    expect(mockEmbedJpg).not.toHaveBeenCalled();
  });

  it.each([
    [8193, 1],
    [1, 8193],
    [4097, 4096],
  ])('rejects a %ix%i PNG before invoking the decoder', async (width, height) => {
    const file = new File([pngBytes(width, height)], 'oversized.png', { type: 'image/png' });
    await expect(convertImageToPdf(file)).rejects.toThrow(/exceeds the browser canvas limits/);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it.each([0, 1, 24, 32])('rejects a truncated PNG (%i bytes) before invoking the decoder', async (length) => {
    const file = new File([pngBytes().slice(0, length)], 'truncated.png', { type: 'image/png' });
    await expect(convertImageToPdf(file)).rejects.toThrow(/Invalid PNG structure/);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures and zero dimensions before invoking the decoder', async () => {
    for (const bytes of [new Uint8Array(45), pngBytes(0, 100), pngBytes(100, 0)]) {
      await expect(convertImageToPdf(new Blob([bytes], { type: 'image/png' }))).rejects.toThrow();
    }
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it('rejects duplicate headers that could override validated dimensions', async () => {
    const original = pngBytes();
    const duplicateHeader = pngBytes(10000, 10000).slice(8, 33);
    const bytes = new Uint8Array(original.length + duplicateHeader.length);
    bytes.set(original.slice(0, -12));
    bytes.set(duplicateHeader, original.length - 12);
    bytes.set(original.slice(-12), original.length - 12 + duplicateHeader.length);
    await expect(convertImageToPdf(new Blob([bytes], { type: 'image/png' }))).rejects.toThrow(/Invalid PNG structure/);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it.each([0x6163544c, 0x6663544c, 0x66644154])('rejects animation chunks (%i) before invoking the decoder', async (type) => {
    const bytes = pngBytes();
    new DataView(bytes.buffer).setUint32(37, type);
    await expect(convertImageToPdf(new Blob([bytes], { type: 'image/png' }))).rejects.toThrow(/Animated PNGs are not supported/);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it('rejects image file to PDF conversion when decoded image exceeds canvas budget', async () => {
    mockEmbeddedDimensions = { width: 10000, height: 10000 };
    const file = new File([pngBytes()], 'huge.png', { type: 'image/png' });
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
