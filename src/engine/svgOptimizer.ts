import { OptimizeOptions } from './types';

export interface OptimizeResult {
  svg: string;
  originalSize: number;
  optimizedSize: number;
  savingsPercentage: number;
}

export function optimizeSvg(
  svgString: string,
  options: OptimizeOptions = {}
): OptimizeResult {
  const precision = options.precision ?? 2;
  const removeComments = options.removeComments ?? true;
  const removeMetadata = options.removeMetadata ?? true;
  const removeTitle = options.removeTitle ?? true;
  const minify = options.minify ?? true;
  const convertColors = options.convertColors ?? true;

  const originalSize = new Blob([svgString]).size;
  let optimized = svgString;

  // 1. Remove comments
  if (removeComments) {
    optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');
  }

  // 2. Remove XML declaration / DOCTYPE / metadata tag / titles / desc
  if (removeMetadata) {
    optimized = optimized.replace(/<\?xml[\s\S]*?\?>/gi, '');
    optimized = optimized.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
    optimized = optimized.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
  }

  if (removeTitle) {
    optimized = optimized.replace(/<title[\s\S]*?<\/title>/gi, '');
    optimized = optimized.replace(/<desc[\s\S]*?<\/desc>/gi, '');
  }

  // 3. Path data cleanup and coordinate rounding
  if (precision >= 0) {
    optimized = optimized.replace(/\bd="([^"]+)"/g, (_, pathD: string) => {
      let roundedD = pathD.replace(/(-?\d+\.\d+)/g, numStr => {
        const num = parseFloat(numStr);
        // Round to precision and strip trailing zeros after decimal
        return Number(num.toFixed(precision)).toString();
      });

      // Remove redundant spaces between path commands and numbers
      roundedD = roundedD
        .replace(/\s*([a-zA-Z])\s*/g, '$1')
        .replace(/([a-zA-Z])\s+/g, '$1')
        .replace(/,-/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

      return `d="${roundedD}"`;
    });
  }

  // 4. Convert hex colors (e.g. #ff0000 -> #f00)
  if (convertColors) {
    optimized = optimized.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3(?![0-9a-fA-F])/g, '#$1$2$3');
  }

  // 5. Clean empty or redundant attributes
  optimized = optimized
    .replace(/\s+(id|class|style)=""/g, '')
    .replace(/\s+stroke-width="1"/g, '');

  // 6. Minify whitespace
  if (minify) {
    optimized = optimized
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const optimizedSize = new Blob([optimized]).size;
  const savings = Math.max(0, originalSize - optimizedSize);
  const savingsPercentage = originalSize > 0
    ? Number(((savings / originalSize) * 100).toFixed(1))
    : 0;

  return {
    svg: optimized,
    originalSize,
    optimizedSize,
    savingsPercentage
  };
}
