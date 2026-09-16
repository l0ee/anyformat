import { PaletteColor } from './types';
import { loadImageData } from './monochromeTracer';

export async function extractPalette(
  fileOrData: File | ImageData,
  maxColors: number = 8
): Promise<PaletteColor[]> {
  const imageData = fileOrData instanceof File ? (await loadImageData(fileOrData, 1024)).imageData : fileOrData;
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  if (totalPixels === 0) return [];

  // Map to group similar colors into buckets
  const colorBuckets = new Map<string, { r: number; g: number; b: number; a: number; count: number }>();

  // Quantize precision factor (e.g. group RGB in steps of 16 for bucket aggregation)
  const step = Math.max(1, Math.floor(totalPixels / 20000));
  const quantizationStep = 16;

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 30) continue; // Ignore transparent pixels

    const qr = Math.floor(r / quantizationStep) * quantizationStep;
    const qg = Math.floor(g / quantizationStep) * quantizationStep;
    const qb = Math.floor(b / quantizationStep) * quantizationStep;

    const key = `${qr},${qg},${qb}`;
    const existing = colorBuckets.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      colorBuckets.set(key, { r, g, b, a, count: 1 });
    }
  }

  const sortedBuckets = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);
  const totalCount = sortedBuckets.reduce((acc, curr) => acc + curr.count, 0) || 1;

  const results: PaletteColor[] = sortedBuckets.slice(0, maxColors).map(item => {
    const percentage = Number(((item.count / totalCount) * 100).toFixed(1));
    const hex = rgbToHex(item.r, item.g, item.b);
    return {
      r: item.r,
      g: item.g,
      b: item.b,
      a: item.a,
      hex,
      percentage
    };
  });

  return results;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}
