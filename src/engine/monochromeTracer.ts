import { Point, MonochromeOptions, TraceResult } from './types';

interface CurveSegment {
  type: 'line' | 'bezier';
  c0: Point;
  c1: Point;
  c2: Point; // end point
}

class BitMap {
  w: number;
  h: number;
  data: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h);
  }

  get(x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false;
    return this.data[y * this.w + x] === 1;
  }

  set(x: number, y: number, val: boolean): void {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      this.data[y * this.w + x] = val ? 1 : 0;
    }
  }

  flip(x: number, y: number): void {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      this.data[y * this.w + x] ^= 1;
    }
  }
}

class Path {
  area: number = 0;
  sign: '+' | '-' = '+';
  pt: Point[] = [];
  lon: Point[] = [];
  sums: { x: number; y: number; x2: number; xy: number; y2: number }[] = [];
  m: number = 0;
  po: number[] = [];
  curves: CurveSegment[] = [];
}

export function loadImageData(file: File, maxDimension: number = 1024): Promise<{ imageData: ImageData; origWidth: number; origHeight: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const origWidth = img.width;
      const origHeight = img.height;

      let width = origWidth;
      let height = origHeight;

      // Downscale ONLY if maxDimension > 0 and width/height exceeds maxDimension
      if (maxDimension > 0 && (width > maxDimension || height > maxDimension)) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Ensure width and height are at least 1 pixel to prevent IndexSizeError
      width = Math.max(1, width);
      height = Math.max(1, height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ imageData, origWidth, origHeight });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err instanceof Error ? err : new Error('Failed to load image file'));
    };
    img.src = url;
  });
}

export function traceMonochromeFromImageData(
  imageData: ImageData,
  options: MonochromeOptions = {}
): TraceResult {
  const threshold = options.threshold ?? 128;
  const invert = options.invert ?? false;
  const turdSize = options.turdSize ?? 2;
  const alphaMax = options.alphaMax ?? 1.0;
  const optTolerance = options.optTolerance ?? 0.2;

  const width = imageData.width;
  const height = imageData.height;

  // Binarize
  const bm = new BitMap(width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Luminance
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let isBlack = luminance < threshold;
    if (a < 128) isBlack = false; // Transparent treated as background
    if (invert) isBlack = !isBlack;
    const x = (i / 4) % width;
    const y = Math.floor((i / 4) / width);
    bm.set(x, y, isBlack);
  }

  // Find paths
  const paths = findPaths(bm, turdSize);

  // Process paths into curves
  let totalNodes = 0;
  let svgPathsStr = '';

  for (const path of paths) {
    processPath(path, alphaMax, optTolerance);
    const d = curveToSvgPath(path.curves);
    if (d) {
      totalNodes += path.curves.length;
      svgPathsStr += `<path d="${d}" fill="${options.blackOnWhite ? '#000000' : 'currentColor'}" fill-rule="evenodd"/>\n`;
    }
  }

  const svg = `<!-- Generator: AnyFormat (https://github.com/l0ee/anyformat) by l0ee -->
<svg xmlns="http://www.w3.org/2000/svg" data-generator="AnyFormat" data-author="l0ee" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <desc>Converted by AnyFormat (https://github.com/l0ee/anyformat) by l0ee</desc>
${svgPathsStr}</svg>`;

  return {
    svg,
    width,
    height,
    pathCount: paths.length,
    nodeCount: totalNodes
  };
}

export async function traceMonochrome(
  fileOrData: File | ImageData,
  options: MonochromeOptions = {}
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

  const result = traceMonochromeFromImageData(imageData, options);

  // Restore SVG viewBox to match original high-res dimensions
  if (origWidth !== result.width || origHeight !== result.height) {
    const svgWithOrigViewBox = result.svg
      .replace(`viewBox="0 0 ${result.width} ${result.height}"`, `viewBox="0 0 ${origWidth} ${origHeight}"`)
      .replace(`width="${result.width}" height="${result.height}"`, `width="${origWidth}" height="${origHeight}"`);

    return {
      ...result,
      width: origWidth,
      height: origHeight,
      svg: svgWithOrigViewBox
    };
  }

  return result;
}

function findPaths(bm: BitMap, turdSize: number): Path[] {
  const paths: Path[] = [];
  const w = bm.w;
  const h = bm.h;
  const visited = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Find unvisited black pixel on boundary
      const idx = y * w + x;
      if (bm.data[idx] === 1 && visited[idx] === 0) {
        // Mark pixel as visited
        visited[idx] = 1;

        // Trace contour boundary
        const path = findContour(bm, x, y, visited);
        if (path && Math.abs(path.area) >= turdSize) {
          paths.push(path);
        }
      }
    }
  }

  return paths;
}

function findContour(bm: BitMap, startX: number, startY: number, visited: Uint8Array): Path | null {
  const path = new Path();
  const pts: Point[] = [];
  let area = 0;

  let x = startX;
  let y = startY;
  let dir = 0; // 0: Right, 1: Down, 2: Left, 3: Up

  // Directions dx, dy
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  const maxSteps = bm.w * bm.h * 2;
  let steps = 0;

  pts.push({ x, y });

  while (steps < maxSteps) {
    steps++;

    // Mark current pixel visited
    if (x >= 0 && x < bm.w && y >= 0 && y < bm.h) {
      visited[y * bm.w + x] = 1;
    }

    // Check pixel to left relative to current direction
    const turnLeftDir = (dir + 3) % 4;
    const lx = x + dx[turnLeftDir];
    const ly = y + dy[turnLeftDir];

    if (bm.get(lx, ly)) {
      dir = turnLeftDir;
      x = lx;
      y = ly;
    } else {
      // Check forward
      const fx = x + dx[dir];
      const fy = y + dy[dir];
      if (bm.get(fx, fy)) {
        x = fx;
        y = fy;
      } else {
        // Turn right
        dir = (dir + 1) % 4;
      }
    }

    pts.push({ x, y });
    area += x * dy[dir];

    // Loop completed
    if (x === startX && y === startY) {
      break;
    }
  }

  if (pts.length < 3) return null;

  path.pt = pts;
  path.area = area;
  path.sign = area > 0 ? '+' : '-';
  return path;
}

function processPath(path: Path, alphaMax: number, optTolerance: number): void {
  const n = path.pt.length;
  if (n < 3) return;

  // Simplify polygon keypoints
  const keypoints = simplifyPolygon(path.pt, alphaMax);

  // Fit curves / lines between keypoints
  path.curves = fitCurves(keypoints, optTolerance);
}

function simplifyPolygon(pts: Point[], alphaMax: number): Point[] {
  const n = pts.length;
  if (n <= 4) return pts;

  const result: Point[] = [pts[0]];
  let prev = pts[0];

  for (let i = 1; i < n - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];

    // Compute angle or corner roughness
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 === 0 || len2 === 0) continue;

    const cosAngle = dot / (len1 * len2);
    // If direction changed noticeably, keep corner
    if (cosAngle < 0.95 * alphaMax) {
      result.push(curr);
      prev = curr;
    }
  }
  result.push(pts[n - 1]);
  return result;
}

function fitCurves(pts: Point[], optTolerance: number): CurveSegment[] {
  const curves: CurveSegment[] = [];
  const n = pts.length;
  if (n < 2) return curves;

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const p2 = pts[(i + 2) % n];

    // If points are roughly collinear within tolerance, use line
    const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (Math.abs(cross) < optTolerance * 10) {
      curves.push({
        type: 'line',
        c0: p0,
        c1: p1,
        c2: p1
      });
    } else {
      // Smooth Catmull-Rom to Bézier control points (C1 continuous)
      const ctrl1 = {
        x: p0.x + (p1.x - prev.x) / 6,
        y: p0.y + (p1.y - prev.y) / 6
      };
      const ctrl2 = {
        x: p1.x - (p2.x - p0.x) / 6,
        y: p1.y - (p2.y - p0.y) / 6
      };
      curves.push({
        type: 'bezier',
        c0: ctrl1,
        c1: ctrl2,
        c2: p1
      });
    }
  }

  return curves;
}

function curveToSvgPath(curves: CurveSegment[]): string {
  if (curves.length === 0) return '';

  let d = `M ${curves[0].c0.x.toFixed(2)} ${curves[0].c0.y.toFixed(2)}`;

  for (const seg of curves) {
    if (seg.type === 'line') {
      d += ` L ${seg.c2.x.toFixed(2)} ${seg.c2.y.toFixed(2)}`;
    } else {
      d += ` C ${seg.c0.x.toFixed(2)} ${seg.c0.y.toFixed(2)}, ${seg.c1.x.toFixed(2)} ${seg.c1.y.toFixed(2)}, ${seg.c2.x.toFixed(2)} ${seg.c2.y.toFixed(2)}`;
    }
  }

  d += ' Z';
  return d;
}
