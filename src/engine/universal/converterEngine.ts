import { traceWorkerClient } from '../../workers/traceWorkerClient';
import { optimizeSvg } from '../svgOptimizer';
import { rasterizeSvgToBlob } from '../svgRasterizer';
import { convertImageToPdf, convertPdfToImage, convertPdfToSvg, convertSvgToPdf } from '../pdfConverter';
import { getFileExtension, isSupportedConversion, SUPPORTED_FORMATS, type ConversionStage } from './types';
import { MAX_CANVAS_EDGE, MAX_CANVAS_PIXELS } from '../canvasLimits';

/**
 * Universal File Converter Engine
 * Performs supported image, SVG, and PDF conversions with browser APIs.
 */
export async function convertUniversalFile(
  file: File,
  targetExt: string,
  onProgress?: (percent: number) => void,
  options?: { pageNumber?: number; signal?: AbortSignal; onStage?: (stage: ConversionStage) => void }
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const signal = options?.signal;
  const stage = (message: ConversionStage) => {
    signal?.throwIfAborted();
    options?.onStage?.(message);
    signal?.throwIfAborted();
  };
  signal?.throwIfAborted();
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const sourceExt = getFileExtension(file.name);
  const targetLower = targetExt.toLowerCase();
  const sourceSpec = SUPPORTED_FORMATS[sourceExt];

  if (!sourceSpec) {
    throw new Error(`Unsupported source format: ${sourceExt ? `.${sourceExt}` : 'unknown'}`);
  }
  if (!isSupportedConversion(sourceExt, targetLower)) {
    throw new Error(`Conversion from .${sourceExt.toUpperCase()} to .${targetLower.toUpperCase()} is not supported.`);
  }

  onProgress?.(20);
  stage('Reading file…');

  // 1. Exporting to PDF (Image / SVG -> PDF)
  if (targetLower === 'pdf') {
    stage('Preparing PDF…');
    onProgress?.(50);
    let blob: Blob;
    if (sourceExt === 'svg' || file.type === 'image/svg+xml') {
      const svgText = await file.text();
      signal?.throwIfAborted();
      blob = await convertSvgToPdf(svgText);
    } else {
      blob = await convertImageToPdf(file);
    }
    stage('Preparing download…');
    onProgress?.(100);
    return { blob, mimeType: 'application/pdf', filename: `${baseName}.pdf` };
  }

  // 2. Exporting from PDF (PDF -> Image / SVG)
  if (sourceExt === 'pdf') {
    stage('Rendering PDF page…');
    onProgress?.(50);
    let blob: Blob;
    let mimeType: string;
    const pageNum = options?.pageNumber && options.pageNumber > 0 ? options.pageNumber : 1;

    if (targetLower === 'svg') {
      blob = await convertPdfToSvg(file, pageNum, { signal, onStage: stage });
      mimeType = 'image/svg+xml';
    } else {
      blob = await convertPdfToImage(file, targetLower, pageNum);
      mimeType = targetLower === 'jpg' || targetLower === 'jpeg' ? 'image/jpeg' : `image/${targetLower}`;
    }

    stage('Preparing download…');
    onProgress?.(100);
    const outName = pageNum > 1 ? `${baseName}_p${pageNum}.${targetLower}` : `${baseName}.${targetLower}`;
    return { blob, mimeType, filename: outName };
  }

  // 3. Convert SVG input to raster (PNG / JPG / WEBP).
  if (sourceExt === 'svg' || file.type === 'image/svg+xml') {
    stage('Rendering SVG…');
    const svgText = await file.text();
    signal?.throwIfAborted();
    const format = targetLower === 'jpg' ? 'jpeg' : (targetLower as 'png' | 'jpeg' | 'webp');
    const blob = await rasterizeSvgToBlob(svgText, { scale: 2, format });
    stage('Preparing download…');
    onProgress?.(100);
    return { blob, mimeType: `image/${format}`, filename: `${baseName}.${targetLower}` };
  }

  // 4. Convert raster input to SVG with the custom tracing worker
  if (targetLower === 'svg') {
    stage('Tracing shapes…');
    onProgress?.(40);
    const traceResult = await traceWorkerClient.traceColor(file, {
      numberOfColors: 8,
      quantization: 'kmeans',
      turdSize: 2,
      alphaMax: 1.0,
      blurRadius: 0,
      maxResolution: 1024,
    }, signal);
    stage('Preparing download…');
    onProgress?.(80);
    const optResult = optimizeSvg(traceResult.svg, {
      precision: 2,
      removeComments: true,
      removeMetadata: true,
      minify: false,
    });
    const blob = new Blob([optResult.svg], { type: 'image/svg+xml' });
    onProgress?.(100);
    return { blob, mimeType: 'image/svg+xml', filename: `${baseName}.svg` };
  }

  // 5. Standard raster-to-raster conversion (PNG / JPG / WEBP) via Canvas.
  stage('Reading image…');
  onProgress?.(50);
  const blob = await convertRasterViaCanvas(file, targetLower, signal, () => stage('Preparing download…'));
  signal?.throwIfAborted();
  onProgress?.(100);

  return {
    blob,
    mimeType: SUPPORTED_FORMATS[targetLower].mime,
    filename: `${baseName}.${targetLower}`,
  };
}

/**
 * Standard HTML5 Canvas Raster Converter
 */
function convertRasterViaCanvas(file: File, targetExt: string, signal?: AbortSignal, onEncode?: () => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        signal?.throwIfAborted();
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Clamp output to browser canvas edge limit and pixel budget
        if (
          width > MAX_CANVAS_EDGE ||
          height > MAX_CANVAS_EDGE ||
          width * height > MAX_CANVAS_PIXELS
        ) {
          const scaleEdge = Math.min(MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height, 1);
          let w = width * scaleEdge;
          let h = height * scaleEdge;
          if (w * h > MAX_CANVAS_PIXELS) {
            const scalePixel = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
            w *= scalePixel;
            h *= scalePixel;
          }
          width = Math.max(1, Math.round(w));
          height = Math.max(1, Math.round(h));
          if (width > MAX_CANVAS_EDGE) width = MAX_CANVAS_EDGE;
          if (height > MAX_CANVAS_EDGE) height = MAX_CANVAS_EDGE;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Fill white background for JPEG if the source has transparency.
        if (targetExt === 'jpg' || targetExt === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = SUPPORTED_FORMATS[targetExt].mime;
        const quality = targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'webp' ? 0.92 : undefined;

        onEncode?.();
        canvas.toBlob(
          (blob) => {
            if (signal?.aborted) {
              reject(signal.reason);
              return;
            }
            if (!blob) {
              reject(new Error(`Failed to convert image to ${targetExt}`));
              return;
            }
            if (blob.type !== mimeType) {
              reject(
                new Error(`Browser returned ${blob.type} instead of requested ${mimeType}. WebP or requested format encoding may not be supported.`)
              );
              return;
            }
            resolve(blob);
          },
          mimeType,
          quality
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };

    img.src = url;
  });
}
