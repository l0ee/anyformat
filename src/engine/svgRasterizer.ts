import { RasterizeOptions } from './types';
import { MAX_CANVAS_EDGE, MAX_CANVAS_PIXELS } from './canvasLimits';

function parseLength(val: string | null): { value: number; isPercent: boolean } | null {
  if (!val) return null;
  val = val.trim();
  if (val.endsWith('%')) {
    const num = parseFloat(val);
    return Number.isFinite(num) ? { value: num, isPercent: true } : null;
  }

  const match = val.match(/^([+-]?(?:\d*\.?\d+(?:[eE][+-]?\d+)?))\s*(in|cm|mm|pt|pc|px|q)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;

  const unit = (match[2] || 'px').toLowerCase();
  switch (unit) {
    case 'in':
      return { value: num * 96, isPercent: false };
    case 'cm':
      return { value: num * (96 / 2.54), isPercent: false };
    case 'mm':
      return { value: num * (96 / 25.4), isPercent: false };
    case 'pt':
      return { value: num * (96 / 72), isPercent: false };
    case 'pc':
      return { value: num * 16, isPercent: false };
    case 'q':
      return { value: num * (96 / 101.6), isPercent: false };
    case 'px':
    default:
      return { value: num, isPercent: false };
  }
}

function parseViewBox(viewBoxAttr: string | null): { width: number; height: number } | null {
  if (!viewBoxAttr) return null;
  const parts = viewBoxAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length >= 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] > 0 && parts[3] > 0) {
    return { width: parts[2], height: parts[3] };
  }
  return null;
}

interface SvgDimensions {
  width: number;
  height: number;
}

function resolveSvgDimensions(svgString: string): SvgDimensions {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new Error(`Root must be an <svg> element, found <${root?.localName || 'null'}>.`);
  }

  const widthParsed = parseLength(root.getAttribute('width'));
  const heightParsed = parseLength(root.getAttribute('height'));
  const vb = parseViewBox(root.getAttribute('viewBox'));

  let width: number | null = null;
  let height: number | null = null;

  if (widthParsed && !widthParsed.isPercent) {
    width = widthParsed.value;
  }
  if (heightParsed && !heightParsed.isPercent) {
    height = heightParsed.value;
  }

  if (width !== null && height === null && vb) {
    height = width / (vb.width / vb.height);
  } else if (height !== null && width === null && vb) {
    width = height * (vb.width / vb.height);
  } else if (width === null && height === null && vb) {
    width = vb.width;
    height = vb.height;
  } else if ((widthParsed?.isPercent || heightParsed?.isPercent) && !vb) {
    throw new Error('Relative dimensions require a valid viewBox to resolve.');
  }

  if (width === null) {
    throw new Error('SVG width cannot be resolved from root attributes or viewBox.');
  }
  if (height === null) {
    throw new Error('SVG height cannot be resolved from root attributes or viewBox.');
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('SVG dimensions must be positive and finite.');
  }

  return { width: Math.round(width), height: Math.round(height) };
}

export async function rasterizeSvgToBlob(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<Blob> {
  const canvas = await svgToCanvas(svgString, options);
  const mimeType =
    options.format === 'jpeg' ? 'image/jpeg' : options.format === 'webp' ? 'image/webp' : 'image/png';
  const quality = options.quality ?? 0.92;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas to Blob conversion failed.'));
          return;
        }
        if (options.format && blob.type !== mimeType) {
          reject(new Error(`Browser returned ${blob.type} instead of ${mimeType}.`));
          return;
        }
        resolve(blob);
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
  const mimeType =
    options.format === 'jpeg' ? 'image/jpeg' : options.format === 'webp' ? 'image/webp' : 'image/png';
  const quality = options.quality ?? 0.92;

  const dataUrl = canvas.toDataURL(mimeType, quality);
  if (options.format) {
    const match = dataUrl.match(/^data:([^;,]+)/);
    const actualMime = match ? match[1] : '';
    if (actualMime && actualMime !== mimeType) {
      throw new Error(`Browser returned ${actualMime} instead of ${mimeType}.`);
    }
  }

  return dataUrl;
}

export async function svgToCanvas(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<HTMLCanvasElement> {
  if (options.scale !== undefined && (!Number.isFinite(options.scale) || options.scale <= 0)) {
    throw new Error('Scale must be a positive, finite number.');
  }
  if (options.width !== undefined && (!Number.isFinite(options.width) || options.width <= 0)) {
    throw new Error('Output width must be a positive, finite number.');
  }
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height <= 0)) {
    throw new Error('Output height must be a positive, finite number.');
  }

  const dimensions = resolveSvgDimensions(svgString);

  let targetWidth: number;
  let targetHeight: number;

  if (options.width !== undefined && options.height !== undefined) {
    targetWidth = options.width;
    targetHeight = options.height;
  } else if (options.width !== undefined) {
    targetWidth = options.width;
    targetHeight = Math.round(options.width / (dimensions.width / dimensions.height));
  } else if (options.height !== undefined) {
    targetHeight = options.height;
    targetWidth = Math.round(options.height * (dimensions.width / dimensions.height));
  } else {
    targetWidth = dimensions.width;
    targetHeight = dimensions.height;
  }

  const scale = options.scale ?? 1;
  targetWidth = Math.round(targetWidth * scale);
  targetHeight = Math.round(targetHeight * scale);

  // Clamp output to both canvas edge limit and pixel budget
  if (
    targetWidth > MAX_CANVAS_EDGE ||
    targetHeight > MAX_CANVAS_EDGE ||
    targetWidth * targetHeight > MAX_CANVAS_PIXELS
  ) {
    const scaleEdge = Math.min(MAX_CANVAS_EDGE / targetWidth, MAX_CANVAS_EDGE / targetHeight, 1);
    let w = targetWidth * scaleEdge;
    let h = targetHeight * scaleEdge;
    if (w * h > MAX_CANVAS_PIXELS) {
      const scalePixel = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
      w *= scalePixel;
      h *= scalePixel;
    }
    targetWidth = Math.max(1, Math.round(w));
    targetHeight = Math.max(1, Math.round(h));
    if (targetWidth > MAX_CANVAS_EDGE) targetWidth = MAX_CANVAS_EDGE;
    if (targetHeight > MAX_CANVAS_EDGE) targetHeight = MAX_CANVAS_EDGE;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas.');
  }

  if (options.backgroundColor || options.format === 'jpeg') {
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

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

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG image into canvas: ${err}`));
    };

    img.src = url;
  });
}
