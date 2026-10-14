import { MAX_CANVAS_EDGE, MAX_CANVAS_PIXELS } from '../canvasLimits';
import { ImageExportOptions } from './types';

export function getImageExportErrors(options: ImageExportOptions = {}): Partial<Record<keyof ImageExportOptions, string>> {
  const errors: Partial<Record<keyof ImageExportOptions, string>> = {};
  for (const dimension of ['width', 'height'] as const) {
    const value = options[dimension];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
      errors[dimension] = `${dimension === 'width' ? 'Width' : 'Height'} must be a positive whole number.`;
    }
  }
  if (options.quality !== undefined && (!Number.isFinite(options.quality) || options.quality < 0 || options.quality > 1)) {
    errors.quality = 'Quality must be between 0 and 1.';
  }
  if (options.background !== undefined && !/^#[\da-f]{6}$/i.test(options.background)) {
    errors.background = 'Background must be a six-digit hex color.';
  }
  return errors;
}

export function calculateOutputDimensions(width: number, height: number, options: ImageExportOptions = {}) {
  if (![width, height].every((value) => Number.isSafeInteger(value) && value >= 1)) {
    throw new Error('Image dimensions must be positive whole numbers.');
  }
  const error = Object.values(getImageExportErrors(options))[0];
  if (error) throw new Error(error);
  let w = options.width ?? width;
  let h = options.height ?? height;
  if (options.keepAspectRatio !== false) {
    const scale = Math.min(
      options.width === undefined ? Infinity : w / width,
      options.height === undefined ? Infinity : h / height,
      options.allowUpscaling && (options.width || options.height) ? Infinity : 1,
    );
    w = width * scale;
    h = height * scale;
  } else if (!options.allowUpscaling) {
    w = Math.min(w, width);
    h = Math.min(h, height);
  }
  // Round requested sizing first; budget reductions still round down.
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const scale = Math.min(1, MAX_CANVAS_EDGE / w, MAX_CANVAS_EDGE / h, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), limited: scale < 1 };
}
