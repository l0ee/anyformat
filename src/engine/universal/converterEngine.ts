import { traceWorkerClient } from '../../workers/traceWorkerClient';
import { optimizeSvg } from '../svgOptimizer';
import { rasterizeSvgToBlob } from '../svgRasterizer';
import { convertImageToPdf, convertPdfToImage, convertPdfToSvg, convertSvgToPdf } from '../pdfConverter';
import { getFileExtension, isSupportedConversion, SUPPORTED_FORMATS } from './types';
import { MAX_CANVAS_EDGE, MAX_CANVAS_PIXELS } from '../canvasLimits';

/**
 * Universal File Converter Engine
 * Performs supported image, SVG, and PDF conversions with browser APIs.
 */
export async function convertUniversalFile(
  file: File,
  targetExt: string,
  onProgress?: (percent: number) => void,
  options?: { pageNumber?: number }
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
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

  // 1. Exporting to PDF (Image / SVG -> PDF)
  if (targetLower === 'pdf') {
    onProgress?.(50);
    let blob: Blob;
    if (sourceExt === 'svg' || file.type === 'image/svg+xml') {
      const svgText = await file.text();
      blob = await convertSvgToPdf(svgText);
    } else {
      blob = await convertImageToPdf(file);
    }
    onProgress?.(100);
    return { blob, mimeType: 'application/pdf', filename: `${baseName}.pdf` };
  }

  // 2. Exporting from PDF (PDF -> Image / SVG)
  if (sourceExt === 'pdf') {
    onProgress?.(50);
    let blob: Blob;
    let mimeType: string;
    const pageNum = options?.pageNumber && options.pageNumber > 0 ? options.pageNumber : 1;

    if (targetLower === 'svg') {
      blob = await convertPdfToSvg(file, pageNum);
      mimeType = 'image/svg+xml';
    } else {
      blob = await convertPdfToImage(file, targetLower, pageNum);
      mimeType = targetLower === 'jpg' || targetLower === 'jpeg' ? 'image/jpeg' : `image/${targetLower}`;
    }

    onProgress?.(100);
    const outName = pageNum > 1 ? `${baseName}_p${pageNum}.${targetLower}` : `${baseName}.${targetLower}`;
    return { blob, mimeType, filename: outName };
  }

  // 3. Convert SVG input to raster (PNG / JPG / WEBP).
  if (sourceExt === 'svg' || file.type === 'image/svg+xml') {
    const svgText = await file.text();
    const format = targetLower === 'jpg' ? 'jpeg' : (targetLower as 'png' | 'jpeg' | 'webp');
    const blob = await rasterizeSvgToBlob(svgText, { scale: 2, format });
    onProgress?.(100);
    return { blob, mimeType: `image/${format}`, filename: `${baseName}.${targetLower}` };
  }

  // 4. Convert raster input to SVG with the custom tracing worker
  if (targetLower === 'svg') {
    onProgress?.(40);
    const traceResult = await traceWorkerClient.traceColor(file, {
      numberOfColors: 8,
      quantization: 'kmeans',
      turdSize: 2,
      alphaMax: 1.0,
      blurRadius: 0,
      maxResolution: 1024,
    });
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
  onProgress?.(50);
  const blob = await convertRasterViaCanvas(file, targetLower);
  onProgress?.(100);

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };

  return {
    blob,
    mimeType: mimeMap[targetLower] || 'image/png',
    filename: `${baseName}.${targetLower}`,
  };
}

/**
 * Standard HTML5 Canvas Raster Converter
 */
function convertRasterViaCanvas(file: File, targetExt: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
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
      if (targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'bmp') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = targetExt === 'jpg' || targetExt === 'jpeg' ? 'image/jpeg' : `image/${targetExt}`;
      const quality = targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'webp' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
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
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };

    img.src = url;
  });
}
