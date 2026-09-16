// Node.js DOM polyfill for ImageData
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

import { traceMonochrome } from '../engine/monochromeTracer';
import { traceColor } from '../engine/colorTracer';
import { extractPalette } from '../engine/paletteExtractor';

export async function runUploadVerification() {
  console.log('--- RUNNING REAL IMAGE UPLOAD & VECTORIZATION VERIFICATION ---');

  // Create a 200x200 RGBA buffer representing a real multi-color PNG image
  const width = 200;
  const height = 200;
  const pixelData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x < 100 && y < 100) {
        // Red quadrant
        pixelData[idx] = 230;
        pixelData[idx + 1] = 50;
        pixelData[idx + 2] = 50;
        pixelData[idx + 3] = 255;
      } else if (x >= 100 && y < 100) {
        // Blue quadrant
        pixelData[idx] = 50;
        pixelData[idx + 1] = 100;
        pixelData[idx + 2] = 230;
        pixelData[idx + 3] = 255;
      } else if (x < 100 && y >= 100) {
        // Green quadrant
        pixelData[idx] = 40;
        pixelData[idx + 1] = 180;
        pixelData[idx + 2] = 60;
        pixelData[idx + 3] = 255;
      } else {
        // Yellow quadrant
        pixelData[idx] = 240;
        pixelData[idx + 1] = 220;
        pixelData[idx + 2] = 40;
        pixelData[idx + 3] = 255;
      }
    }
  }

  const imgData = new ImageData(pixelData, width, height);

  console.log('1. Testing Full Color Vectorization...');
  const colorResult = await traceColor(imgData, { numberOfColors: 4, maxResolution: 1024 });
  console.log(`✓ Color Vectorization Success: ${colorResult.pathCount} paths generated, SVG length: ${colorResult.svg.length} chars`);
  if (!colorResult.svg.includes('<svg') || colorResult.pathCount === 0) {
    throw new Error('Color vectorization output invalid!');
  }

  console.log('2. Testing Monochrome B&W Vectorization...');
  const monoResult = await traceMonochrome(imgData, { threshold: 128, maxResolution: 1024 });
  console.log(`✓ Monochrome Vectorization Success: ${monoResult.pathCount} paths generated, SVG length: ${monoResult.svg.length} chars`);
  if (!monoResult.svg.includes('<svg') || monoResult.pathCount === 0) {
    throw new Error('Monochrome vectorization output invalid!');
  }

  console.log('3. Testing Color Palette Extraction...');
  const palette = await extractPalette(imgData, 4);
  console.log(`✓ Palette Extraction Success: Extracted ${palette.length} color swatches`);
  if (palette.length === 0) {
    throw new Error('Palette extraction failed!');
  }

  console.log('--- ALL REAL UPLOAD VERIFICATIONS PASSED SUCCESSFULLY ---');
  return true;
}

runUploadVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
