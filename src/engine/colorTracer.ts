import { ColorTracerOptions, PaletteColor, TraceResult } from './types';
import { traceMonochromeFromImageData, loadImageData } from './monochromeTracer';

export function traceColorFromImageData(
  imageData: ImageData,
  options: ColorTracerOptions = {},
  origWidth?: number,
  origHeight?: number
): TraceResult {
  console.log('[DEBUG] traceColorFromImageData started');
  const oWidth = origWidth ?? imageData.width;
  const oHeight = origHeight ?? imageData.height;

  const numberOfColors = Math.max(2, Math.min(32, options.numberOfColors ?? 8));
  const turdSize = options.turdSize ?? 4;
  const alphaMax = options.alphaMax ?? 1.0;
  const optTolerance = options.optTolerance ?? 0.2;
  const minColorRatio = options.minColorRatio ?? 0.005;

  const width = imageData.width;
  const height = imageData.height;

  if (width === 0 || height === 0) {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0" width="0" height="0"></svg>`,
      width: 0,
      height: 0,
      pathCount: 0,
      nodeCount: 0,
      colors: []
    };
  }

  const { palette, pixelAssignments } = quantizeKMeans(imageData, numberOfColors);

  // 2. Count frequencies & compute percentage
  const totalPixels = width * height;
  const colorCounts = new Array(palette.length).fill(0);
  for (let i = 0; i < pixelAssignments.length; i++) {
    const assignment = pixelAssignments[i];
    // 255 is reserved for transparent pixels (the palette is capped at 32 colors).
    if (assignment < colorCounts.length) colorCounts[assignment]++;
  }

  const paletteColors: PaletteColor[] = palette.map((col, idx) => {
    const count = colorCounts[idx];
    const percentage = totalPixels > 0 ? Number(((count / totalPixels) * 100).toFixed(2)) : 0;
    const hex = rgbToHex(col.r, col.g, col.b);
    return {
      r: col.r,
      g: col.g,
      b: col.b,
      a: col.a,
      hex,
      percentage
    };
  });

  // Sort colors by luminance or area ratio (darkest to lightest or largest to smallest)
  paletteColors.sort((a, b) => b.percentage - a.percentage);

  // 3. Trace each color layer using a single reused Uint8ClampedArray buffer to prevent OOM
  let totalPaths = 0;
  let totalNodes = 0;
  let svgLayersStr = '';

  const layerData = new Uint8ClampedArray(width * height * 4);
  const maskImg = new ImageData(layerData, width, height);

  for (const color of paletteColors) {
    if (color.percentage / 100 < minColorRatio) continue;
    if (color.a < 10) continue; // Skip near transparent

    // Find index of this color in original palette
    const origIdx = palette.findIndex(
      p => p.r === color.r && p.g === color.g && p.b === color.b
    );
    if (origIdx === -1) continue;

    // Fill binary mask for this color layer into reused buffer
    for (let i = 0; i < pixelAssignments.length; i++) {
      const pixelIdx = pixelAssignments[i];
      const offset = i * 4;
      if (pixelIdx === origIdx) {
        layerData[offset] = 0;       // R
        layerData[offset + 1] = 0;   // G
        layerData[offset + 2] = 0;   // B
        layerData[offset + 3] = 255; // Solid black mask for tracer
      } else {
        layerData[offset] = 255;
        layerData[offset + 1] = 255;
        layerData[offset + 2] = 255;
        layerData[offset + 3] = 0;   // Transparent
      }
    }

    // Trace layer
    const trace = traceMonochromeFromImageData(maskImg, {
      threshold: 128,
      turdSize,
      alphaMax,
      optTolerance,
      blackOnWhite: false
    });

    if (trace.pathCount > 0) {
      totalPaths += trace.pathCount;
      totalNodes += trace.nodeCount;

      // Extract path string content from monochrome result
      const pathsContent = extractPathsFromSvg(trace.svg, color.hex);
      if (pathsContent) {
        svgLayersStr += `  <g id="layer-${color.hex.replace('#', '')}" fill="${color.hex}">\n${pathsContent}\n  </g>\n`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${oWidth}" height="${oHeight}">
${svgLayersStr}</svg>`;

  return {
    svg,
    width: oWidth,
    height: oHeight,
    pathCount: totalPaths,
    nodeCount: totalNodes,
    colors: paletteColors
  };
}

export async function traceColor(
  fileOrData: File | ImageData,
  options: ColorTracerOptions = {}
): Promise<TraceResult> {
  let imageData: ImageData;
  let origWidth: number;
  let origHeight: number;

  if (fileOrData instanceof File) {
    const loaded = await loadImageData(fileOrData, 1024);
    imageData = loaded.imageData;
    origWidth = loaded.origWidth;
    origHeight = loaded.origHeight;
  } else {
    imageData = fileOrData;
    origWidth = imageData.width;
    origHeight = imageData.height;
  }

  return traceColorFromImageData(imageData, options, origWidth, origHeight);
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function quantizeKMeans(
  imageData: ImageData,
  k: number
): { palette: RGBColor[]; pixelAssignments: Uint8Array } {
  const data = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  const pixelAssignments = new Uint8Array(pixelCount);

  // Subsample RGB into flat Uint8Array (3 bytes per sample: R, G, B)
  const targetSamples = 5000;
  const step = Math.max(1, Math.floor(pixelCount / targetSamples));
  const maxSampleCount = Math.ceil(pixelCount / step);
  const samplesBuffer = new Uint8Array(maxSampleCount * 3);
  let sampleCount = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3];
    if (a > 30) {
      const idx = sampleCount * 3;
      samplesBuffer[idx] = data[i];
      samplesBuffer[idx + 1] = data[i + 1];
      samplesBuffer[idx + 2] = data[i + 2];
      sampleCount++;
    }
  }

  console.log('[DEBUG] quantizeKMeans sampleCount:', sampleCount);
  if (sampleCount === 0) {
    pixelAssignments.fill(255);
    return {
      palette: [{ r: 0, g: 0, b: 0, a: 0 }],
      pixelAssignments
    };
  }

  // Initialize centroids from flat buffer
  const actualK = Math.min(k, sampleCount);
  const centroidsR = new Uint8Array(actualK);
  const centroidsG = new Uint8Array(actualK);
  const centroidsB = new Uint8Array(actualK);

  const stepSize = Math.max(1, Math.floor(sampleCount / actualK));
  for (let c = 0; c < actualK; c++) {
    const sIdx = ((c * stepSize) % sampleCount) * 3;
    centroidsR[c] = samplesBuffer[sIdx];
    centroidsG[c] = samplesBuffer[sIdx + 1];
    centroidsB[c] = samplesBuffer[sIdx + 2];
  }

  // K-Means iterations
  const maxIter = 8;
  const sumR = new Float64Array(actualK);
  const sumG = new Float64Array(actualK);
  const sumB = new Float64Array(actualK);
  const counts = new Uint32Array(actualK);

  for (let iter = 0; iter < maxIter; iter++) {
    sumR.fill(0);
    sumG.fill(0);
    sumB.fill(0);
    counts.fill(0);

    for (let i = 0; i < sampleCount; i++) {
      const sOffset = i * 3;
      const sr = samplesBuffer[sOffset];
      const sg = samplesBuffer[sOffset + 1];
      const sb = samplesBuffer[sOffset + 2];

      let minDist = Infinity;
      let closest = 0;

      for (let c = 0; c < actualK; c++) {
        const dr = sr - centroidsR[c];
        const dg = sg - centroidsG[c];
        const db = sb - centroidsB[c];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }

      sumR[closest] += sr;
      sumG[closest] += sg;
      sumB[closest] += sb;
      counts[closest]++;
    }

    let moved = false;
    for (let c = 0; c < actualK; c++) {
      if (counts[c] > 0) {
        const nr = Math.round(sumR[c] / counts[c]);
        const ng = Math.round(sumG[c] / counts[c]);
        const nb = Math.round(sumB[c] / counts[c]);

        if (nr !== centroidsR[c] || ng !== centroidsG[c] || nb !== centroidsB[c]) {
          centroidsR[c] = nr;
          centroidsG[c] = ng;
          centroidsB[c] = nb;
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  // Assign every pixel to nearest centroid
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (a < 30) {
      // Keep transparent pixels out of every generated color layer instead of
      // assigning them to the first palette color.
      pixelAssignments[i] = 255;
      continue;
    }

    let minDist = Infinity;
    let closest = 0;
    for (let c = 0; c < actualK; c++) {
      const dr = r - centroidsR[c];
      const dg = g - centroidsG[c];
      const db = b - centroidsB[c];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }
    pixelAssignments[i] = closest;
  }

  const palette: RGBColor[] = [];
  for (let c = 0; c < actualK; c++) {
    palette.push({
      r: centroidsR[c],
      g: centroidsG[c],
      b: centroidsB[c],
      a: 255
    });
  }

  return { palette, pixelAssignments };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractPathsFromSvg(svg: string, fillColor: string): string {
  const startIdx = svg.indexOf('<path');
  if (startIdx === -1) return '';
  const endIdx = svg.lastIndexOf('/>');
  if (endIdx === -1) return '';

  const pathsOnly = svg.substring(startIdx, endIdx + 2);
  return pathsOnly.split('fill="currentColor"').join(`fill="${fillColor}"`)
                  .split('fill="#000000"').join(`fill="${fillColor}"`);
}
