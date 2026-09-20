import JSZip from 'jszip';

export interface ZipExportItem {
  filename: string;
  content: string | Blob | ArrayBuffer;
}

export async function exportBatchZip(items: ZipExportItem[]): Promise<Blob> {
  const zip = new JSZip();
  const reserved = new Set(items.map((i) => i.filename));
  const usedNames = new Set<string>();

  for (const item of items) {
    let finalName = item.filename;

    if (usedNames.has(finalName)) {
      const lastDot = finalName.lastIndexOf('.');
      const hasExt = lastDot > 0;
      const base = hasExt ? finalName.slice(0, lastDot) : finalName;
      const ext = hasExt ? finalName.slice(lastDot) : '';

      let counter = 2;
      while (
        usedNames.has(`${base} (${counter})${ext}`) ||
        reserved.has(`${base} (${counter})${ext}`)
      ) {
        counter++;
      }
      finalName = `${base} (${counter})${ext}`;
    }

    usedNames.add(finalName);
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
