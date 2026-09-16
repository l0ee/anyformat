import JSZip from 'jszip';

export interface ZipExportItem {
  filename: string;
  content: string | Blob | ArrayBuffer;
}

export async function exportBatchZip(items: ZipExportItem[]): Promise<Blob> {
  const zip = new JSZip();

  for (const item of items) {
    zip.file(item.filename, item.content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
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
  URL.revokeObjectURL(url);
}
