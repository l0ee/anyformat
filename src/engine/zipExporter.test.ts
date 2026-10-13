import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { exportBatchZip, ZipExportItem } from './zipExporter';

async function readEntries(blob: Blob): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.entries(zip.files);

  for (const [filename, entry] of entries) {
    expect(entry.dir).toBe(false);
    // loadAsync strips traversal on import; inspect the stored name as well.
    expect(entry.unsafeOriginalName).toBe(filename);
    expect(filename).not.toMatch(/[/\\:]/);
  }
  expect(new Set(entries.map(([filename]) => filename.toLowerCase())).size).toBe(entries.length);

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

  it('skips suffixes reserved by other inputs and handles extensionless and flattened names', async () => {
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
      'icon.svg': 'first icon',
      'icon (2).svg': 'second icon',
    });
  });

  it.each([
    ['folder/icon.svg', 'icon.svg'],
    ['../../../icon.svg', 'icon.svg'],
    ['..\\..\\icon.svg', 'icon.svg'],
    ['../nested\\../icon.svg', 'icon.svg'],
    ['/absolute/icon.svg', 'icon.svg'],
    ['C:\\exports\\icon.svg', 'icon.svg'],
    ['\\\\server\\share\\icon.svg', 'icon.svg'],
    ['C:icon.svg', 'C_icon.svg'],
    ['image:stream.png', 'image_stream.png'],
    ['invalid<>:"|?*.svg', 'invalid_______.svg'],
    ['icon\u0000\u001f\u007f\u0085.svg', 'icon____.svg'],
    ['name.svg.  ', 'name.svg'],
    ['', 'file'],
    ['.', 'file'],
    ['..', 'file'],
    [' ... ', 'file'],
    ['folder/', 'file'],
    ['folder\\', 'file'],
    ['CON.svg', '_CON.svg'],
    ['nul', '_nul'],
    ['PRN.txt', '_PRN.txt'],
    ['aux.backup.svg', '_aux.backup.svg'],
    ['com1.png', '_com1.png'],
    ['LPT9.svg', '_LPT9.svg'],
    ['console.svg', 'console.svg'],
    ['COM10.svg', 'COM10.svg'],
    ['.hidden.svg', '.hidden.svg'],
    ['étoile 🌟.png', 'étoile 🌟.png'],
  ])('exports %j as the flat stored name %j', async (filename, expectedName) => {
    await expect(readEntries(await exportBatchZip([{ filename, content: 'original bytes' }]))).resolves.toEqual({
      [expectedName]: 'original bytes',
    });
  });

  it('reserves normalized names before resolving path and case collisions', async () => {
    const items: ZipExportItem[] = [
      { filename: 'folder/Icon.svg', content: 'first' },
      { filename: '../../../icon.svg', content: 'second' },
      { filename: 'other/ICON (2).svg', content: 'reserved second' },
      { filename: 'icon.svg', content: 'third' },
    ];

    await expect(readEntries(await exportBatchZip(items))).resolves.toEqual({
      'Icon.svg': 'first',
      'icon (3).svg': 'second',
      'ICON (2).svg': 'reserved second',
      'icon (4).svg': 'third',
    });
  });

  it('retains every content after character, fallback, and reserved-device collisions', async () => {
    const items: ZipExportItem[] = [
      { filename: 'icon?.svg', content: 'question mark' },
      { filename: 'icon*.svg', content: 'asterisk' },
      { filename: '..', content: 'dot fallback' },
      { filename: '', content: 'empty fallback' },
      { filename: 'FILE (2)', content: 'reserved fallback' },
      { filename: 'CON.svg', content: 'device name' },
      { filename: '_con.svg', content: 'ordinary name' },
    ];

    await expect(readEntries(await exportBatchZip(items))).resolves.toEqual({
      'icon_.svg': 'question mark',
      'icon_ (2).svg': 'asterisk',
      file: 'dot fallback',
      'file (3)': 'empty fallback',
      'FILE (2)': 'reserved fallback',
      '_CON.svg': 'device name',
      '_con (2).svg': 'ordinary name',
    });
  });

  it('retains ArrayBuffer bytes and does not mutate the input items', async () => {
    const content = new Uint8Array([0, 127, 128, 255]).buffer;
    const items: ZipExportItem[] = [{ filename: '../binary.png', content }];
    const zip = await JSZip.loadAsync(await (await exportBatchZip(items)).arrayBuffer());

    expect(zip.file('binary.png')?.unsafeOriginalName).toBe('binary.png');
    expect(await zip.file('binary.png')!.async('uint8array')).toEqual(new Uint8Array(content));
    expect(items).toEqual([{ filename: '../binary.png', content }]);
    expect(items[0].content).toBe(content);
  });

  it('embeds AnyFormat creator comment in the zip archive', async () => {
    const items: ZipExportItem[] = [{ filename: 'file.txt', content: 'test' }];
    const blob = await exportBatchZip(items);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer()) as unknown as { comment?: string };
    expect(zip.comment).toContain('AnyFormat');
    expect(zip.comment).toContain('l0ee');
  });
});
