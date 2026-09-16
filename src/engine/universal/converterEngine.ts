import { traceWorkerClient } from '../../workers/traceWorkerClient';
import { optimizeSvg } from '../svgOptimizer';
import { rasterizeSvgToBlob } from '../svgRasterizer';

/**
 * Universal File Converter Engine
 * Performs supported image and SVG conversions with browser APIs.
 */
export async function convertUniversalFile(
  file: File,
  targetExt: string,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const targetLower = targetExt.toLowerCase();

  onProgress?.(20);

  // 1. Convert SVG input to Raster (PNG / JPG / WEBP / PDF)
  if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
    const svgText = await file.text();
    if (targetLower === 'pdf') {
      const pngBlob = await rasterizeSvgToBlob(svgText, { scale: 2, format: 'png' });
      const pdfBlob = await imageBlobToPdfBlob(pngBlob);
      onProgress?.(100);
      return { blob: pdfBlob, mimeType: 'application/pdf', filename: `${baseName}.pdf` };
    } else {
      const format = targetLower === 'jpg' ? 'jpeg' : (targetLower as 'png' | 'jpeg' | 'webp');
      const blob = await rasterizeSvgToBlob(svgText, { scale: 2, format });
      onProgress?.(100);
      return { blob, mimeType: `image/${format}`, filename: `${baseName}.${targetLower}` };
    }
  }

  // 2. Convert raster input to SVG with the custom tracing worker
  if (targetLower === 'svg') {
    onProgress?.(40);
    const traceResult = await traceWorkerClient.traceColor(file, {
      numberOfColors: 8,
      quantization: 'median-cut',
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

  // 3. Convert Raster to PDF
  if (targetLower === 'pdf') {
    onProgress?.(50);
    const pdfBlob = await imageBlobToPdfBlob(file);
    onProgress?.(100);
    return { blob: pdfBlob, mimeType: 'application/pdf', filename: `${baseName}.pdf` };
  }

  // 4. Convert Raster to ICO (Favicon)
  if (targetLower === 'ico') {
    onProgress?.(50);
    const icoBlob = await rasterToIcoBlob(file);
    onProgress?.(100);
    return { blob: icoBlob, mimeType: 'image/x-icon', filename: `${baseName}.ico` };
  }

  // 5. Standard Raster to Raster (PNG / JPG / WEBP / BMP) via HTML5 Canvas
  onProgress?.(50);
  const blob = await convertRasterViaCanvas(file, targetLower);
  onProgress?.(100);

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    bmp: 'image/bmp',
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
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Fill white background for JPEG/BMP if image has transparency
      if (targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'bmp') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = targetExt === 'jpg' || targetExt === 'jpeg' ? 'image/jpeg' : `image/${targetExt}`;
      const quality = targetExt === 'jpg' || targetExt === 'jpeg' || targetExt === 'webp' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error(`Failed to convert image to ${targetExt}`));
          }
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

/**
 * Convert Image Blob to PDF Blob using basic PDF structure (Pure Client-Side)
 */
async function imageBlobToPdfBlob(fileOrBlob: Blob): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const img = new Image();
  const url = URL.createObjectURL(fileOrBlob);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const base64Data = jpegDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create lightweight PDF binary structure
  const pdfHeader = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${canvas.width} ${canvas.height}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`;
  const pdfFooter = `\nendstream\nendobj\n5 0 obj\n<< /Length 56 >>\nstream\nq\n${canvas.width} 0 0 ${canvas.height} 0 0 cm\n/Im1 Do\nQ\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000270 00000 n \n0000000450 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n556\n%%EOF`;

  const encoder = new TextEncoder();
  const hBytes = encoder.encode(pdfHeader);
  const fBytes = encoder.encode(pdfFooter);

  const pdfBuffer = new Uint8Array(hBytes.length + bytes.length + fBytes.length);
  pdfBuffer.set(hBytes, 0);
  pdfBuffer.set(bytes, hBytes.length);
  pdfBuffer.set(fBytes, hBytes.length + bytes.length);

  return new Blob([pdfBuffer], { type: 'application/pdf' });
}

/**
 * Convert Image to 32x32 Favicon ICO Blob
 */
async function rasterToIcoBlob(file: File): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  ctx?.drawImage(img, 0, 0, 32, 32);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('ICO conversion failed'));
    }, 'image/x-icon');
  });
}
