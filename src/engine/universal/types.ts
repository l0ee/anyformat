export type FileCategory = 'image' | 'document' | 'vector';

export interface FormatSpec {
  ext: string;
  mime: string;
  label: string;
  category: FileCategory;
  canExportTo: string[]; // extensions this format can be converted into
}

export const SUPPORTED_FORMATS: Record<string, FormatSpec> = {
  png: {
    ext: 'png',
    mime: 'image/png',
    label: 'PNG Image',
    category: 'image',
    canExportTo: ['jpg', 'webp', 'svg'],
  },
  jpg: {
    ext: 'jpg',
    mime: 'image/jpeg',
    label: 'JPEG Image',
    category: 'image',
    canExportTo: ['png', 'webp', 'svg'],
  },
  jpeg: {
    ext: 'jpeg',
    mime: 'image/jpeg',
    label: 'JPEG Image',
    category: 'image',
    canExportTo: ['png', 'webp', 'svg'],
  },
  webp: {
    ext: 'webp',
    mime: 'image/webp',
    label: 'WebP Image',
    category: 'image',
    canExportTo: ['png', 'jpg', 'svg'],
  },
  bmp: {
    ext: 'bmp',
    mime: 'image/bmp',
    label: 'BMP Bitmap',
    category: 'image',
    canExportTo: ['png', 'jpg', 'webp', 'svg'],
  },
  svg: {
    ext: 'svg',
    mime: 'image/svg+xml',
    label: 'SVG Vector',
    category: 'vector',
    canExportTo: ['png', 'jpg', 'webp'],
  },
};

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isSupportedSourceExtension(extension: string): boolean {
  return Boolean(SUPPORTED_FORMATS[extension.toLowerCase()]);
}

export function isSupportedConversion(sourceExtension: string, targetExtension: string): boolean {
  return Boolean(
    SUPPORTED_FORMATS[sourceExtension.toLowerCase()]?.canExportTo.includes(targetExtension.toLowerCase()),
  );
}

export function getCommonExportTargets(sourceExtensions: string[]): string[] {
  if (sourceExtensions.length === 0) return [];

  const first = SUPPORTED_FORMATS[sourceExtensions[0].toLowerCase()];
  if (!first) return [];

  return first.canExportTo.filter((target) =>
    sourceExtensions.every((extension) =>
      SUPPORTED_FORMATS[extension.toLowerCase()]?.canExportTo.includes(target)
    )
  );
}

export interface UniversalTaskItem {
  id: string;
  file: File;
  name: string;
  sourceExt: string;
  targetExt: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  previewUrl?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultSize?: number;
  error?: string;
}
