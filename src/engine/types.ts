export interface Point {
  x: number;
  y: number;
}

export type TurnPolicy = 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';

export interface MonochromeOptions {
  threshold?: number; // 0..255, default 128
  invert?: boolean; // default false
  turdSize?: number; // despeckle pixel threshold, default 2
  alphaMax?: number; // corner threshold parameter, default 1.0
  optTolerance?: number; // curve optimization tolerance, default 0.2
  turnPolicy?: TurnPolicy; // default 'minority'
  blackOnWhite?: boolean;
  maxResolution?: number; // Max dimension for image scaling, e.g. 1024
}

export interface ColorTracerOptions {
  numberOfColors?: number; // 2..64, default 8
  quantization?: 'kmeans' | 'median-cut' | 'octree';
  turdSize?: number; // despeckle pixel threshold, default 2
  alphaMax?: number; // corner threshold parameter, default 1.0
  optTolerance?: number; // curve optimization tolerance, default 0.2
  blurRadius?: number; // Gaussian blur radius before tracing
  minColorRatio?: number; // Ignore color layers below this area ratio
  strokeWidth?: number; // Optional outline width
  maxResolution?: number; // Max dimension for image scaling, e.g. 1024
}

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
  percentage: number;
}

export interface RasterizeOptions {
  width?: number;
  height?: number;
  scale?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0..1 for jpeg/webp
  backgroundColor?: string;
}

export interface OptimizeOptions {
  precision?: number; // decimal places for numbers, default 2
  removeComments?: boolean;
  removeMetadata?: boolean;
  removeTitle?: boolean;
  minify?: boolean;
  convertColors?: boolean;
}

export interface TraceResult {
  svg: string;
  width: number;
  height: number;
  pathCount: number;
  nodeCount: number;
  colors?: PaletteColor[];
}

export interface TraceWorkerTask {
  id: string;
  type: 'monochrome' | 'color';
  imageData: ImageData;
  options?: MonochromeOptions | ColorTracerOptions;
  origWidth?: number;
  origHeight?: number;
}

export interface TraceWorkerResult {
  id: string;
  status: 'success' | 'error';
  result?: TraceResult;
  error?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  svgResult?: string;
  previewUrl?: string;
  error?: string;
  width?: number;
  height?: number;
}

export type PresetType = 'logo' | 'photo' | 'clipart';

export interface PresetConfig {
  name: string;
  description: string;
  mode: 'monochrome' | 'color';
  monochromeOptions?: MonochromeOptions;
  colorOptions?: ColorTracerOptions;
}
