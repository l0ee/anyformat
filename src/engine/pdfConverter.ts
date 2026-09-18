import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { rasterizeSvgToBlob } from './svgRasterizer';
import { traceWorkerClient } from '../workers/traceWorkerClient';
import { optimizeSvg } from './svgOptimizer';

// Configure pdfjs worker for Vite environment
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

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
  const pdfDoc = await loadingTask.promise;

  if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}. Document has ${pdfDoc.numPages} pages.`);
  }

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert PDF page to ${targetExt}`));
        }
      },
      mimeType,
      quality
    );
  });
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
    quantization: 'median-cut',
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
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
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
