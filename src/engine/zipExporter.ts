export interface ZipExportItem {
  filename: string;
  content: string | Blob | ArrayBuffer;
}

function normalizeZipFilename(filename: string): string {
  const basename = (filename.split(/[/\\]/).pop() || '')
    .replace(/[<>:"|?*]|\p{Cc}/gu, '_')
    .replace(/[. ]+$/g, '') || 'file';

  // Windows reserves device names even when they have an extension.
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(basename)
    ? `_${basename}`
    : basename;
}

export async function exportBatchZip(items: ZipExportItem[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  // Reserve the same flat, case-insensitive namespace used for final names.
  const normalizedItems = items.map((item) => ({ ...item, filename: normalizeZipFilename(item.filename) }));
  const reserved = new Set(normalizedItems.map((item) => item.filename.toLowerCase()));
  const usedNames = new Set<string>();

  for (const item of normalizedItems) {
    let finalName = item.filename;

    if (usedNames.has(finalName.toLowerCase())) {
      const lastDot = finalName.lastIndexOf('.');
      const hasExt = lastDot > 0;
      const base = hasExt ? finalName.slice(0, lastDot) : finalName;
      const ext = hasExt ? finalName.slice(lastDot) : '';

      let counter = 2;
      while (
        usedNames.has(`${base} (${counter})${ext}`.toLowerCase()) ||
        reserved.has(`${base} (${counter})${ext}`.toLowerCase())
      ) {
        counter++;
      }
      finalName = `${base} (${counter})${ext}`;
    }

    usedNames.add(finalName.toLowerCase());
    zip.file(finalName, item.content);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    comment: 'Exported with AnyFormat (https://github.com/l0ee/anyformat) by l0ee',
  });
  return zipBlob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
