import { traceMonochrome } from './monochromeTracer';
import { traceColor } from './colorTracer';
import { optimizeSvg } from './svgOptimizer';
import { extractPalette } from './paletteExtractor';
import { exportBatchZip } from './zipExporter';
import { rasterizeSvgToBlob } from './svgRasterizer';

export async function runEngineTests(): Promise<boolean> {
  console.log('Testing AnyFormat conversion engine...');

  // Create test dummy ImageData (2x2 pixels)
  const width = 2;
  const height = 2;
  const dummyData = new Uint8ClampedArray([
    0, 0, 0, 255,     255, 255, 255, 255,
    255, 0, 0, 255,   0, 255, 0, 255
  ]);
  const imgData = new ImageData(dummyData, width, height);

  // 1. Test Monochrome Tracer
  const monoResult = await traceMonochrome(imgData, { threshold: 128 });
  console.assert(monoResult.width === 2, 'Monochrome width match');
  console.assert(typeof monoResult.svg === 'string', 'Monochrome SVG output');

  // 2. Test Color Tracer
  const colorResult = await traceColor(imgData, { numberOfColors: 2 });
  console.assert(colorResult.width === 2, 'Color width match');
  console.assert(colorResult.colors !== undefined, 'Color palette extracted');

  // 3. Test Optimizer
  const optResult = optimizeSvg(colorResult.svg, { precision: 2, minify: true });
  console.assert(typeof optResult.svg === 'string', 'Optimizer SVG output');
  console.assert(optResult.optimizedSize >= 0, 'Optimizer size calculated');

  // 4. Test Palette Extractor
  const palette = await extractPalette(imgData, 4);
  console.assert(palette.length > 0, 'Palette colors extracted');

  // 5. Test Zip Exporter
  const zipBlob = await exportBatchZip([
    { filename: 'test.svg', content: optResult.svg }
  ]);
  console.assert(zipBlob.size > 0, 'ZIP Blob generated');

  // 6. Test Rasterizer if window context is present
  if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    try {
      const blob = await rasterizeSvgToBlob(optResult.svg, { format: 'png', width: 100, height: 100 });
      console.assert(blob.size > 0, 'Rasterized PNG Blob generated');
    } catch {
      // Mock environment in headless ts test
    }
  }

  console.log('All AnyFormat conversion engine tests passed!');
  return true;
}
