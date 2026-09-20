import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { exportBatchZip, ZipExportItem } from './zipExporter';

async function readEntries(blob: Blob): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);

  return Object.fromEntries(
    await Promise.all(entries.map(async ([filename, entry]) => [filename, await entry.async('string')]))
  );
}

describe('exportBatchZip', () => {
  it('preserves ordinary filenames and their contents', async () => {
    const items: ZipExportItem[] = [
      { filename: 'logo.svg', content: '<svg>logo</svg>' },
      { filename: 'photo.png', content: 'photo bytes' },
    ];

    await expect(readEntries(await exportBatchZip(items))).resolves.toEqual({
      'logo.svg': '<svg>logo</svg>',
      'photo.png': 'photo bytes',
    });
  });

  it('adds stable suffixes before extensions for duplicate filenames', async () => {
    const items: ZipExportItem[] = [
      { filename: 'drawing.svg', content: 'first' },
      { filename: 'drawing.svg', content: 'second' },
      { filename: 'drawing.svg', content: 'third' },
    ];

    await expect(readEntries(await exportBatchZip(items))).resolves.toEqual({
      'drawing.svg': 'first',
      'drawing (2).svg': 'second',
      'drawing (3).svg': 'third',
    });
  });

  it('skips suffixes reserved by other inputs and handles extensionless and nested names', async () => {
    const items: ZipExportItem[] = [
      { filename: 'drawing.svg', content: 'first drawing' },
      { filename: 'drawing.svg', content: 'second drawing' },
      { filename: 'drawing (2).svg', content: 'explicit second drawing' },
      { filename: 'drawing.svg', content: 'third drawing' },
      { filename: 'README', content: 'first readme' },
      { filename: 'README', content: 'second readme' },
      { filename: 'folder/icon.svg', content: 'first icon' },
      { filename: 'folder/icon.svg', content: 'second icon' },
    ];

    await expect(readEntries(await exportBatchZip(items))).resolves.toEqual({
      'drawing.svg': 'first drawing',
      'drawing (2).svg': 'explicit second drawing',
      'drawing (3).svg': 'second drawing',
      'drawing (4).svg': 'third drawing',
      README: 'first readme',
      'README (2)': 'second readme',
      'folder/icon.svg': 'first icon',
      'folder/icon (2).svg': 'second icon',
    });
  });

  it('embeds AnyFormat creator comment in the zip archive', async () => {
    const items: ZipExportItem[] = [{ filename: 'file.txt', content: 'test' }];
    const blob = await exportBatchZip(items);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer()) as unknown as { comment?: string };
    expect(zip.comment).toContain('AnyFormat');
    expect(zip.comment).toContain('l0ee');
  });
});
