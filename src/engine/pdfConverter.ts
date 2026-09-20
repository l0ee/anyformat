import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { rasterizeSvgToBlob } from './svgRasterizer';
import { traceWorkerClient } from '../workers/traceWorkerClient';
import { optimizeSvg } from './svgOptimizer';

import {
  MAX_CANVAS_EDGE,
  MAX_CANVAS_PIXELS,
  assertCanvasDimensionsWithinBudget,
} from './canvasLimits';

// Configure pdfjs worker for Vite environment
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Returns the total page count for a given PDF file.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  try {
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const docWithCleanup = pdfDoc as unknown as { cleanup?: () => unknown; destroy?: () => unknown };
    if (typeof docWithCleanup.cleanup === 'function') {
      await Promise.resolve(docWithCleanup.cleanup()).catch(() => {});
    }
    if (typeof docWithCleanup.destroy === 'function') {
      await Promise.resolve(docWithCleanup.destroy()).catch(() => {});
    }
    return numPages;
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Converts a page of a PDF file to an image Blob (PNG, JPG, WEBP).
 */
export async function convertPdfToImage(
  file: File,
  targetExt: string,
  pageNumber: number = 1
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  try {
    const pdfDoc = await loadingTask.promise;

    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${pdfDoc.numPages} pages.`);
    }

    const page = await pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1.0 });

    if (
      !Number.isFinite(baseViewport.width) ||
      !Number.isFinite(baseViewport.height) ||
      baseViewport.width <= 0 ||
      baseViewport.height <= 0
    ) {
      throw new Error('PDF page has invalid dimensions.');
    }

    // Compute adaptive scale up to 2.0 while guaranteeing we don't exceed the canvas budget
    const maxScaleEdge = Math.min(
      MAX_CANVAS_EDGE / baseViewport.width,
      MAX_CANVAS_EDGE / baseViewport.height
    );
    const maxScalePixels = Math.sqrt(
      MAX_CANVAS_PIXELS / (baseViewport.width * baseViewport.height)
    );
    const targetScale = Math.min(2.0, maxScaleEdge, maxScalePixels);
    const safeScale = Number.isFinite(targetScale) && targetScale > 0 ? targetScale : 0.01;
    const viewport = page.getViewport({ scale: safeScale });

    assertCanvasDimensionsWithinBudget(viewport.width, viewport.height, 'PDF page');

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    const lowerTarget = targetExt.toLowerCase();
    if (lowerTarget === 'jpg' || lowerTarget === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await (page.render as unknown as (params: Record<string, unknown>) => { promise: Promise<void> })({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const mimeType = lowerTarget === 'jpg' || lowerTarget === 'jpeg' ? 'image/jpeg' : `image/${lowerTarget}`;
    const quality = lowerTarget === 'jpg' || lowerTarget === 'jpeg' || lowerTarget === 'webp' ? 0.92 : undefined;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            if (blob.type !== mimeType) {
              reject(
                new Error(`Browser does not support exporting PDF to ${targetExt} (${mimeType})`)
              );
              return;
            }
            resolve(blob);
          } else {
            reject(new Error(`Failed to convert PDF page to ${targetExt}`));
          }
        },
        mimeType,
        quality
      );
    });
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Converts a PDF page to SVG.
 * First renders PDF page to image canvas, then uses tracer worker to convert to SVG.
 */
export async function convertPdfToSvg(file: File, pageNumber: number = 1): Promise<Blob> {
  const imageBlob = await convertPdfToImage(file, 'png', pageNumber);
  const imageFile = new File([imageBlob], 'temp_pdf_page.png', { type: 'image/png' });

  const traceResult = await traceWorkerClient.traceColor(imageFile, {
    numberOfColors: 8,
    quantization: 'kmeans',
    turdSize: 2,
    alphaMax: 1.0,
    blurRadius: 0,
    maxResolution: 1024,
  });

  const optResult = optimizeSvg(traceResult.svg, {
    precision: 2,
    removeComments: true,
    removeMetadata: true,
    minify: false,
  });

  return new Blob([optResult.svg], { type: 'image/svg+xml' });
}

/**
 * Converts an Image (File or Blob) to PDF using pdf-lib.
 */
export async function convertImageToPdf(file: File | Blob): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  if (typeof pdfDoc.setTitle === 'function') {
    pdfDoc.setTitle('Converted with AnyFormat');
    pdfDoc.setAuthor('l0ee');
    pdfDoc.setCreator('AnyFormat');
    pdfDoc.setProducer('AnyFormat (https://github.com/l0ee/anyformat) by l0ee');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());
  }

  const arrayBuffer = await file.arrayBuffer();

  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  let image;
  if (isJpeg) {
    image = await pdfDoc.embedJpg(arrayBuffer);
  } else {
    // Canvas conversion to PNG if non-PNG/JPEG image provided
    if (file.type !== 'image/png') {
      const pngBlob = await convertBlobToPng(file);
      const pngBuffer = await pngBlob.arrayBuffer();
      image = await pdfDoc.embedPng(pngBuffer);
    } else {
      image = await pdfDoc.embedPng(arrayBuffer);
    }
  }

  assertCanvasDimensionsWithinBudget(image.width, image.height, 'Image for PDF');

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Helper to convert arbitrary image blob to PNG blob via canvas.
 */
function convertBlobToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;
      if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth < 1 || naturalHeight < 1) {
        reject(new Error('Image has invalid dimensions for PDF embedding'));
        return;
      }

      // Cap dimensions according to canvas budget
      const edgeScale = Math.min(1, MAX_CANVAS_EDGE / Math.max(naturalWidth, naturalHeight));
      const areaScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (naturalWidth * naturalHeight)));
      const scale = Math.min(edgeScale, areaScale);
      const targetWidth = Math.max(1, Math.floor(naturalWidth * scale));
      const targetHeight = Math.max(1, Math.floor(naturalHeight * scale));

      assertCanvasDimensionsWithinBudget(targetWidth, targetHeight, 'Image for PDF');

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to convert image to PNG'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for PDF embedding'));
    };
    img.src = url;
  });
}

/**
 * Converts SVG text content to PDF by first rasterizing SVG to PNG blob, then embedding in PDF.
 */
export async function convertSvgToPdf(svgContent: string): Promise<Blob> {
  const pngBlob = await rasterizeSvgToBlob(svgContent, { scale: 2, format: 'png' });
  return convertImageToPdf(pngBlob);
}
