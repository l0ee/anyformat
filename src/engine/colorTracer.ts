import { ColorTracerOptions, PaletteColor, TraceResult } from './types';
import { traceMonochromeFromImageData, loadImageData } from './monochromeTracer';

function createImageDataSafe(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    const ImageDataCtor = ImageData as unknown as new (
      swOrData: Uint8ClampedArray,
      shOrWidth: number,
      settingsOrHeight?: number
    ) => ImageData;
    return new ImageDataCtor(data, width, height);
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// Separable 2-pass box blur for image smoothing prior to quantization
function applyBlur(imageData: ImageData, radius: number): ImageData {
  if (radius <= 0) return imageData;
  const r = Math.min(Math.floor(radius), 10);
  const w = imageData.width;
  const h = imageData.height;
  if (w <= 0 || h <= 0) return imageData;
  const src = imageData.data;
  const target = new Uint8ClampedArray(src.length);

  // Horizontal pass
  const temp = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      const minX = Math.max(0, x - r);
      const maxX = Math.min(w - 1, x + r);
      for (let k = minX; k <= maxX; k++) {
        const idx = (rowOffset + k) * 4;
        rSum += src[idx];
        gSum += src[idx + 1];
        bSum += src[idx + 2];
        aSum += src[idx + 3];
        count++;
      }
      const outIdx = (rowOffset + x) * 4;
      temp[outIdx] = Math.round(rSum / count);
      temp[outIdx + 1] = Math.round(gSum / count);
      temp[outIdx + 2] = Math.round(bSum / count);
      temp[outIdx + 3] = Math.round(aSum / count);
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      const minY = Math.max(0, y - r);
      const maxY = Math.min(h - 1, y + r);
      for (let k = minY; k <= maxY; k++) {
        const idx = (k * w + x) * 4;
        rSum += temp[idx];
        gSum += temp[idx + 1];
        bSum += temp[idx + 2];
        aSum += temp[idx + 3];
        count++;
      }
      const outIdx = (y * w + x) * 4;
      target[outIdx] = Math.round(rSum / count);
      target[outIdx + 1] = Math.round(gSum / count);
      target[outIdx + 2] = Math.round(bSum / count);
      target[outIdx + 3] = Math.round(aSum / count);
    }
  }

  return createImageDataSafe(target, w, h);
}

export function traceColorFromImageData(
  imageData: ImageData,
  options: ColorTracerOptions = {},
  origWidth?: number,
  origHeight?: number
): TraceResult {
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
      svg: `<!-- Generator: AnyFormat (https://github.com/l0ee/anyformat) by l0ee -->\n<svg xmlns="http://www.w3.org/2000/svg" data-generator="AnyFormat" data-author="l0ee" viewBox="0 0 0 0" width="0" height="0"></svg>`,
      width: 0,
      height: 0,
      pathCount: 0,
      nodeCount: 0,
      colors: []
    };
  }

  const effectiveImageData = options.blurRadius && options.blurRadius > 0
    ? applyBlur(imageData, options.blurRadius)
    : imageData;

  const { palette, pixelAssignments } = quantizeKMeans(effectiveImageData, numberOfColors);

  // 2. Count frequencies & compute percentage
  const totalPixels = width * height;
  const colorCounts = new Array(palette.length).fill(0);
  for (let i = 0; i < pixelAssignments.length; i++) {
    const assignment = pixelAssignments[i];
    // 255 is reserved for transparent pixels (the palette is capped at 32 colors).
    if (assignment < colorCounts.length) colorCounts[assignment]++;
  }

  const paletteColors = palette.map((col, idx) => {
    const count = colorCounts[idx];
    const percentage = totalPixels > 0 ? Number(((count / totalPixels) * 100).toFixed(2)) : 0;
    const hex = rgbToHex(col.r, col.g, col.b);
    return {
      r: col.r,
      g: col.g,
      b: col.b,
      a: col.a,
      hex,
      percentage,
      origIdx: idx
    };
  });

  // Sort colors by luminance or area ratio (darkest to lightest or largest to smallest)
  paletteColors.sort((a, b) => b.percentage - a.percentage);

  // 3. Trace each color layer using a single reused Uint8ClampedArray buffer to prevent OOM
  let totalPaths = 0;
  let totalNodes = 0;
  let svgLayersStr = '';

  const layerData = new Uint8ClampedArray(width * height * 4);
  const maskImg = createImageDataSafe(layerData, width, height);

  for (const color of paletteColors) {
    if (color.percentage / 100 < minColorRatio) continue;
    if (color.a < 10) continue; // Skip near transparent

    const origIdx = color.origIdx;

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
        const opacityAttr = color.a < 255 ? ` fill-opacity="${Number((color.a / 255).toFixed(2))}"` : '';
        const strokeAttr = (options.strokeWidth !== undefined && options.strokeWidth > 0)
          ? ` stroke="${color.hex}" stroke-width="${options.strokeWidth}"`
          : '';
        svgLayersStr += `  <g id="layer-${color.hex.replace('#', '')}" fill="${color.hex}"${opacityAttr}${strokeAttr}>\n${pathsContent}\n  </g>\n`;
      }
    }
  }

  const svg = `<!-- Generator: AnyFormat (https://github.com/l0ee/anyformat) by l0ee -->
<svg xmlns="http://www.w3.org/2000/svg" data-generator="AnyFormat" data-author="l0ee" viewBox="0 0 ${width} ${height}" width="${oWidth}" height="${oHeight}">
  <desc>Converted by AnyFormat (https://github.com/l0ee/anyformat) by l0ee</desc>
${svgLayersStr}</svg>`;

  return {
    svg,
    width: oWidth,
    height: oHeight,
    pathCount: totalPaths,
    nodeCount: totalNodes,
    colors: paletteColors.map((col): PaletteColor => ({
      r: col.r,
      g: col.g,
      b: col.b,
      a: col.a,
      hex: col.hex,
      percentage: col.percentage,
    })),
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
    const loaded = await loadImageData(fileOrData, options.maxResolution ?? 1024);
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

  // Subsample RGBA into flat Uint8Array (4 bytes per sample: R, G, B, A)
  const targetSamples = 5000;
  const step = Math.max(1, Math.floor(pixelCount / targetSamples));
  const maxSampleCount = Math.ceil(pixelCount / step);
  const samplesBuffer = new Uint8Array(maxSampleCount * 4);
  let sampleCount = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3];
    if (a > 30) {
      const idx = sampleCount * 4;
      samplesBuffer[idx] = data[i];
      samplesBuffer[idx + 1] = data[i + 1];
      samplesBuffer[idx + 2] = data[i + 2];
      samplesBuffer[idx + 3] = a;
      sampleCount++;
    }
  }

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
  const centroidsA = new Uint8Array(actualK);

  const stepSize = Math.max(1, Math.floor(sampleCount / actualK));
  for (let c = 0; c < actualK; c++) {
    const sIdx = ((c * stepSize) % sampleCount) * 4;
    centroidsR[c] = samplesBuffer[sIdx];
    centroidsG[c] = samplesBuffer[sIdx + 1];
    centroidsB[c] = samplesBuffer[sIdx + 2];
    centroidsA[c] = samplesBuffer[sIdx + 3];
  }

  // K-Means iterations in 4D (RGBA)
  const maxIter = 8;
  const sumR = new Float64Array(actualK);
  const sumG = new Float64Array(actualK);
  const sumB = new Float64Array(actualK);
  const sumA = new Float64Array(actualK);
  const counts = new Uint32Array(actualK);

  for (let iter = 0; iter < maxIter; iter++) {
    sumR.fill(0);
    sumG.fill(0);
    sumB.fill(0);
    sumA.fill(0);
    counts.fill(0);

    for (let i = 0; i < sampleCount; i++) {
      const sOffset = i * 4;
      const sr = samplesBuffer[sOffset];
      const sg = samplesBuffer[sOffset + 1];
      const sb = samplesBuffer[sOffset + 2];
      const sa = samplesBuffer[sOffset + 3];

      let minDist = Infinity;
      let closest = 0;

      for (let c = 0; c < actualK; c++) {
        const dr = sr - centroidsR[c];
        const dg = sg - centroidsG[c];
        const db = sb - centroidsB[c];
        const da = sa - centroidsA[c];
        const dist = dr * dr + dg * dg + db * db + da * da;
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }

      sumR[closest] += sr;
      sumG[closest] += sg;
      sumB[closest] += sb;
      sumA[closest] += sa;
      counts[closest]++;
    }

    let moved = false;
    for (let c = 0; c < actualK; c++) {
      if (counts[c] > 0) {
        const nr = Math.round(sumR[c] / counts[c]);
        const ng = Math.round(sumG[c] / counts[c]);
        const nb = Math.round(sumB[c] / counts[c]);
        const na = Math.round(sumA[c] / counts[c]);

        if (nr !== centroidsR[c] || ng !== centroidsG[c] || nb !== centroidsB[c] || na !== centroidsA[c]) {
          centroidsR[c] = nr;
          centroidsG[c] = ng;
          centroidsB[c] = nb;
          centroidsA[c] = na;
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  // Assign every pixel to nearest centroid using 4D distance
  const finalSumA = new Float64Array(actualK);
  const clusterCounts = new Uint32Array(actualK);

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
      const da = a - centroidsA[c];
      const dist = dr * dr + dg * dg + db * db + da * da;
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }
    pixelAssignments[i] = closest;
    finalSumA[closest] += a;
    clusterCounts[closest]++;
  }

  const palette: RGBColor[] = [];
  for (let c = 0; c < actualK; c++) {
    const avgA = clusterCounts[c] > 0 ? Math.round(finalSumA[c] / clusterCounts[c]) : centroidsA[c];
    palette.push({
      r: centroidsR[c],
      g: centroidsG[c],
      b: centroidsB[c],
      a: avgA
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
