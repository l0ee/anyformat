import { RasterizeOptions } from './types';

/**
 * Rasterizes an SVG string into a Canvas, Blob, or Data URL.
 */
export async function rasterizeSvgToBlob(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<Blob> {
  const canvas = await svgToCanvas(svgString, options);
  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : options.format === 'webp' ? 'image/webp' : 'image/png';
  const quality = options.quality ?? 0.92;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed.'));
      },
      mimeType,
      quality
    );
  });
}

export async function rasterizeSvgToDataUrl(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<string> {
  const canvas = await svgToCanvas(svgString, options);
  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : options.format === 'webp' ? 'image/webp' : 'image/png';
  const quality = options.quality ?? 0.92;

  return canvas.toDataURL(mimeType, quality);
}

export async function svgToCanvas(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<HTMLCanvasElement> {
  // Parse viewBox / dimensions from SVG string
  const dimensions = parseSvgDimensions(svgString);
  const scale = options.scale ?? 1;
  const targetWidth = Math.round((options.width ?? dimensions.width) * scale);
  const targetHeight = Math.round((options.height ?? dimensions.height) * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas.');
  }

  // Draw background color if requested (e.g. for JPEG)
  if (options.backgroundColor || options.format === 'jpeg') {
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // Create Blob URL for SVG string
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG image into canvas: ${err}`));
    };

    img.src = url;
  });
}

function parseSvgDimensions(svgString: string): { width: number; height: number } {
  const widthMatch = svgString.match(/width="([0-9.]+)"/);
  const heightMatch = svgString.match(/height="([0-9.]+)"/);
  const viewBoxMatch = svgString.match(/viewBox="([0-9.\s]+)"/);

  let width = widthMatch ? parseFloat(widthMatch[1]) : 0;
  let height = heightMatch ? parseFloat(heightMatch[1]) : 0;

  if ((!width || !height) && viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length >= 4) {
      width = parts[2];
      height = parts[3];
    }
  }

  return {
    width: width || 800,
    height: height || 600
  };
}
