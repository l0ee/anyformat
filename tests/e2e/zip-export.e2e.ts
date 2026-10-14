import { expect, test, type Download } from '@playwright/test';
import JSZip from 'jszip';

async function readDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function expectFlatArchive(download: Download, expectedContents: Map<string, Buffer>) {
  const zip = await JSZip.loadAsync(await readDownload(download));
  const entries = Object.values(zip.files);
  expect(entries.map((entry) => entry.name)).toEqual([...expectedContents.keys()]);
  expect((zip as unknown as { comment?: string }).comment).toContain('AnyFormat');
  for (const entry of entries) {
    expect(entry.dir).toBe(false);
    expect(entry.unsafeOriginalName).toBe(entry.name);
    expect(entry.name).not.toMatch(/[/\\:]/);
    expect(Buffer.from(await entry.async('uint8array'))).toEqual(expectedContents.get(entry.name));
  }
}

test('Universal ZIP export flattens paths and retains colliding PNG Blob outputs', async ({ page }) => {
  await page.goto('/');
  const names = ['folder/Logo.svg', '..\\logo.svg', 'other/LOGO (2).svg'];
  const outputNames = ['Logo.png', 'logo (3).png', 'LOGO (2).png'];
  const colors = ['red', 'blue', 'green'];
  await page.locator('input[type="file"]').setInputFiles(names.map((name, index) => ({
    name, mimeType: 'image/svg+xml',
    buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${colors[index]}"/></svg>`),
  })));
  const queue = page.getByRole('region', { name: 'Format conversion queue (3)' });
  await expect(queue).toBeVisible();
  await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
  await expect(queue.getByRole('status', { name: 'Format conversion status' })).toContainText('3 completed · 0 failed', { timeout: 60_000 });

  const contents = new Map<string, Buffer>();
  for (const [index, name] of names.entries()) {
    const row = queue.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await row.getByRole('button', { name: 'Preview', exact: true }).click();
    const bytes = await row.getByRole('img', { name: `Converted preview for ${name}`, exact: true }).evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      return Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer()));
    });
    expect(bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    contents.set(outputNames[index], Buffer.from(bytes));
  }
  expect(new Set([...contents.values()].map((bytes) => bytes.toString('hex'))).size).toBe(3);
  const pendingDownload = page.waitForEvent('download');
  await queue.getByRole('button', { name: 'Export ZIP (3)', exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('converted_files.zip');
  await expectFlatArchive(download, contents);
});

test('Vector Batch ZIP export flattens paths and retains every traced SVG', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.getByRole('button', { name: 'Work with multiple images', exact: true }).click();
  const names = ['folder/Logo.png', '..\\logo.png', 'other/LOGO (2).png'];
  const outputNames = ['Logo.svg', 'logo (3).svg', 'LOGO (2).svg'];
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d')!;
    return [8, 16, 24].map((width) => {
      context.fillStyle = 'white';
      context.fillRect(0, 0, 32, 32);
      context.fillStyle = 'black';
      context.fillRect(0, 0, width, 32);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  });
  await page.locator('input[type="file"]').setInputFiles(names.map((name, index) => ({
    name, mimeType: 'image/png', buffer: Buffer.from(images[index], 'base64'),
  })));
  const queue = page.getByRole('region', { name: 'Batch queue (3 files)' });
  await expect(queue).toBeVisible();
  await queue.getByRole('button', { name: 'Process batch', exact: true }).click();
  await expect(queue.getByRole('status')).toContainText('3 completed · 0 failed', { timeout: 60_000 });

  const contents = new Map<string, Buffer>();
  for (const [index, name] of names.entries()) {
    const row = queue.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await row.getByRole('button', { name: 'Preview', exact: true }).click();
    const src = await row.getByRole('img', { name: `Converted SVG preview for ${name}`, exact: true }).getAttribute('src');
    expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeURIComponent(src!.slice(src!.indexOf(',') + 1));
    expect(svg).toContain('<svg');
    contents.set(outputNames[index], Buffer.from(svg));
  }
  expect(new Set([...contents.values()].map((bytes) => bytes.toString('hex'))).size).toBe(3);
  const pendingDownload = page.waitForEvent('download');
  await queue.getByRole('button', { name: 'Export 3 as ZIP', exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('vectorized_batch.zip');
  await expectFlatArchive(download, contents);
});
