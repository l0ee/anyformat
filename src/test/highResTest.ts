// Node environment polyfill for ImageData if missing
if (typeof ImageData === 'undefined') {
  Object.defineProperty(globalThis, 'ImageData', {
    value: class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = data;
      }
    },
    configurable: true,
    writable: true,
  });
}

import { traceColorFromImageData } from '../engine/colorTracer';
import { traceMonochromeFromImageData } from '../engine/monochromeTracer';

export async function run4KVerification(): Promise<void> {
  const width = 3840;
  const height = 2160;

  // Create 4K image data efficiently
  const buffer = new Uint8ClampedArray(width * height * 4);
  const halfW = width / 2;
  const halfH = height / 2;

  // Fill four 4K quadrants with distinct solid colors (Red, Blue, Black, White)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    const isTop = y < halfH;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const isLeft = x < halfW;

      if (isTop && isLeft) {
        buffer[idx] = 255; buffer[idx + 3] = 255; // Red
      } else if (isTop && !isLeft) {
        buffer[idx + 2] = 255; buffer[idx + 3] = 255; // Blue
      } else if (!isTop && isLeft) {
        buffer[idx + 3] = 255; // Black
      } else {
        buffer[idx] = 255; buffer[idx + 1] = 255; buffer[idx + 2] = 255; buffer[idx + 3] = 255; // White
      }
    }
  }

  const imageData = new ImageData(buffer, width, height);

  // Test Monochrome at 4K original resolution
  const monoResult = traceMonochromeFromImageData(imageData, { threshold: 128 });
  if (monoResult.width !== width || monoResult.height !== height) {
    throw new Error(`Monochrome 4K width/height mismatch: got ${monoResult.width}x${monoResult.height}, expected ${width}x${height}`);
  }
  if (monoResult.pathCount <= 0) {
    throw new Error(`Monochrome 4K path count must be > 0, got ${monoResult.pathCount}`);
  }
  if (!monoResult.svg.includes(`width="${width}" height="${height}"`)) {
    throw new Error(`Monochrome 4K SVG width/height attribute missing or invalid`);
  }

  // Test Color at 4K original resolution
  const colorResult = traceColorFromImageData(imageData, { numberOfColors: 4 }, width, height);
  if (colorResult.width !== width || colorResult.height !== height) {
    throw new Error(`Color 4K width/height mismatch: got ${colorResult.width}x${colorResult.height}, expected ${width}x${height}`);
  }
  if (colorResult.pathCount <= 0) {
    throw new Error(`Color 4K path count must be > 0, got ${colorResult.pathCount}`);
  }
  if (!colorResult.svg.includes(`width="${width}" height="${height}"`)) {
    throw new Error(`Color 4K SVG width/height attribute missing or invalid`);
  }

  console.log('4K Verification Succeeded!');
  console.log(`Mono Result: ${monoResult.width}x${monoResult.height}, ${monoResult.pathCount} paths`);
  console.log(`Color Result: ${colorResult.width}x${colorResult.height}, ${colorResult.pathCount} paths`);
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  run4KVerification().catch((err) => {
    console.error('4K Verification Failed:', err);
    process.exit(1);
  });
}
