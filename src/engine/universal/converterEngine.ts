import { traceWorkerClient } from '../../workers/traceWorkerClient';
import { optimizeSvg } from '../svgOptimizer';
import { rasterizeSvgToBlob } from '../svgRasterizer';
import { convertImageToPdf, convertPdfToImage, convertPdfToSvg, convertSvgToPdf } from '../pdfConverter';
import { ConversionOptions, ConversionStage, ImageExportOptions, ImageOutputMetadata, getFileExtension, isSupportedConversion, SUPPORTED_FORMATS } from './types';
import { calculateOutputDimensions, getImageExportErrors } from './imageTransform';
import { assertImageDecodeDimensions, assertRasterDecodeBudget } from '../../utils/imageDecodeLimits';

/**
 * Universal File Converter Engine
 * Performs supported image, SVG, and PDF conversions with browser APIs.
 */
export async function convertUniversalFile(
  file: File,
  targetExt: string,
  onProgress?: (percent: number) => void,
  options?: ConversionOptions
): Promise<{ blob: Blob; mimeType: string; filename: string; imageOutput?: ImageOutputMetadata }> {
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
  const { blob, imageOutput } = await convertRasterViaCanvas(file, targetLower, options?.image, signal, () => stage('Preparing download…'));
  signal?.throwIfAborted();
  onProgress?.(100);

  return {
    blob,
    imageOutput,
    mimeType: SUPPORTED_FORMATS[targetLower].mime,
    filename: `${baseName}.${targetLower}`,
  };
}

/**
 * Standard HTML5 Canvas Raster Converter
 */
async function convertRasterViaCanvas(
  file: File,
  targetExt: string,
  options: ImageExportOptions = {},
  signal?: AbortSignal,
  onEncode?: () => void
): Promise<{ blob: Blob; imageOutput: ImageOutputMetadata }> {
  const settingsError = Object.values(getImageExportErrors(options))[0];
  if (settingsError) throw new Error(settingsError);
  await assertRasterDecodeBudget(file);
  signal?.throwIfAborted();
  const img = new Image();
  const url = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = url;
    });
    signal?.throwIfAborted();
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    assertImageDecodeDimensions(sourceWidth, sourceHeight);
    const imageOutput = calculateOutputDimensions(sourceWidth, sourceHeight, options);
    const { width, height } = imageOutput;

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // JPEG has no alpha channel; flatten transparency onto the selected color.
    if (targetExt === 'jpg' || targetExt === 'jpeg') {
      ctx.fillStyle = options.background ?? '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = SUPPORTED_FORMATS[targetExt].mime;
    const quality = ['jpg', 'jpeg', 'webp'].includes(targetExt) ? (options.quality ?? 0.92) : undefined;
    const outputCanvas = canvas;
    onEncode?.();
    const blob = await new Promise<Blob | null>((resolve) => outputCanvas.toBlob(resolve, mimeType, quality));
    signal?.throwIfAborted();
    if (!blob) throw new Error(`Failed to convert image to ${targetExt}`);
    if (blob.type !== mimeType) {
      throw new Error(`Browser returned ${blob.type} instead of requested ${mimeType}. WebP or requested format encoding may not be supported.`);
    }
    return { blob, imageOutput };
  } finally {
    img.onload = null;
    img.onerror = null;
    img.removeAttribute?.('src');
    URL.revokeObjectURL(url);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
