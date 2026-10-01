export type FileCategory = 'image' | 'document' | 'vector';

export type ConversionStage =
  | 'Reading file…'
  | 'Reading image…'
  | 'Rendering PDF page…'
  | 'Preparing PDF…'
  | 'Rendering SVG…'
  | 'Tracing shapes…'
  | 'Preparing download…';

/** Applies to every local file intake flow. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '100 MB';

export interface FormatSpec {
  ext: string;
  mime: string;
  label: string;
  category: FileCategory;
  canExportTo: string[]; // extensions this format can be converted into
}

/**
 * Raster formats accepted by Vector Studio and Vector Batch. These remain
 * separate from universal conversion capabilities because GIF is traceable,
 * but is not currently offered by the universal conversion engine.
 */
export const VECTOR_STUDIO_INPUT_FORMATS = [
  { ext: 'png', mime: 'image/png', label: 'PNG' },
  { ext: 'jpg', mime: 'image/jpeg', label: 'JPEG' },
  { ext: 'jpeg', mime: 'image/jpeg', label: 'JPEG' },
  { ext: 'webp', mime: 'image/webp', label: 'WebP' },
  { ext: 'bmp', mime: 'image/bmp', label: 'BMP' },
  { ext: 'gif', mime: 'image/gif', label: 'GIF' },
] as const;

export const SUPPORTED_FORMATS: Record<string, FormatSpec> = {
  png: {
    ext: 'png',
    mime: 'image/png',
    label: 'PNG Image',
    category: 'image',
    canExportTo: ['jpg', 'webp', 'svg', 'pdf'],
  },
  jpg: {
    ext: 'jpg',
    mime: 'image/jpeg',
    label: 'JPEG Image',
    category: 'image',
    canExportTo: ['png', 'webp', 'svg', 'pdf'],
  },
  jpeg: {
    ext: 'jpeg',
    mime: 'image/jpeg',
    label: 'JPEG Image',
    category: 'image',
    canExportTo: ['png', 'webp', 'svg', 'pdf'],
  },
  webp: {
    ext: 'webp',
    mime: 'image/webp',
    label: 'WebP Image',
    category: 'image',
    canExportTo: ['png', 'jpg', 'svg', 'pdf'],
  },
  bmp: {
    ext: 'bmp',
    mime: 'image/bmp',
    label: 'BMP Bitmap',
    category: 'image',
    canExportTo: ['png', 'jpg', 'webp', 'svg', 'pdf'],
  },
  svg: {
    ext: 'svg',
    mime: 'image/svg+xml',
    label: 'SVG Vector',
    category: 'vector',
    canExportTo: ['png', 'jpg', 'webp', 'pdf'],
  },
  pdf: {
    ext: 'pdf',
    mime: 'application/pdf',
    label: 'PDF Document',
    category: 'document',
    canExportTo: ['png', 'jpg', 'webp', 'svg'],
  },
};

export const getUniqueFormatLabels = (formats: readonly { label: string }[]): string[] =>
  [...new Set(formats.map((format) => format.label))];

export const getUniversalInputFormatLabels = (): string[] =>
  getUniqueFormatLabels(Object.values(SUPPORTED_FORMATS));

export const getUniversalOutputFormatLabels = (): string[] =>
  getUniqueFormatLabels(
    [...new Set(Object.values(SUPPORTED_FORMATS).flatMap((format) => format.canExportTo))]
      .map((extension) => SUPPORTED_FORMATS[extension])
      .filter((format): format is FormatSpec => Boolean(format))
  );

export const getUniversalInputAccept = (): string =>
  Object.values(SUPPORTED_FORMATS)
    .flatMap((format) => [`.${format.ext}`, format.mime])
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(',');

export const getVectorStudioInputAccept = (): string =>
  VECTOR_STUDIO_INPUT_FORMATS
    .flatMap((format) => [`.${format.ext}`, format.mime])
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(',');

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isSupportedSourceExtension(extension: string): boolean {
  if (!extension) return false;
  const key = extension.toLowerCase();
  return Object.prototype.hasOwnProperty.call(SUPPORTED_FORMATS, key);
}

export function isSupportedConversion(sourceExtension: string, targetExtension: string): boolean {
  if (!sourceExtension || !targetExtension) return false;
  const sKey = sourceExtension.toLowerCase();
  const tKey = targetExtension.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_FORMATS, sKey)) return false;
  return Boolean(SUPPORTED_FORMATS[sKey]?.canExportTo.includes(tKey));
}

export function getCommonExportTargets(sourceExtensions: string[]): string[] {
  if (sourceExtensions.length === 0) return [];

  const firstKey = sourceExtensions[0].toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_FORMATS, firstKey)) return [];
  const first = SUPPORTED_FORMATS[firstKey];

  return first.canExportTo.filter((target) =>
    sourceExtensions.every((extension) => {
      const extKey = extension.toLowerCase();
      return (
        Object.prototype.hasOwnProperty.call(SUPPORTED_FORMATS, extKey) &&
        SUPPORTED_FORMATS[extKey]?.canExportTo.includes(target)
      );
    })
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
  stage?: ConversionStage;
  previewUrl?: string;
  resultBlob?: Blob;
  resultFilename?: string;
  resultUrl?: string;
  resultSize?: number;
  error?: string;
  pageNumber?: number;
  pageCount?: number;
}
