import { readImageHeaderDimensions } from './imageHeader';

// Source decode budget; output canvases have a separate, smaller budget.
export const MAX_DECODE_EDGE = 16_384;
export const MAX_DECODE_PIXELS = 67_108_864;

export function assertImageDecodeDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Image has invalid dimensions.');
  }
  if (width > MAX_DECODE_EDGE || height > MAX_DECODE_EDGE || width * height > MAX_DECODE_PIXELS) {
    throw new Error(`Image dimensions (${width}x${height}) exceed maximum allowable size (16,384px per edge / 64MP).`);
  }
}

export async function assertRasterDecodeBudget(file: Blob): Promise<void> {
  const dimensions = await readImageHeaderDimensions(file);
  // Unknown headers retain browser-decoder compatibility. Callers must also
  // validate decoded dimensions; this bounded preflight is not a full parser.
  if (dimensions) assertImageDecodeDimensions(dimensions.width, dimensions.height);
}
