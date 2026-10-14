import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

declare global {
  interface Window {
    __intakePreviewNames: string[];
  }
}

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');

async function trackPreviews(page: Page) {
  await page.addInitScript(() => {
    window.__intakePreviewNames = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      if (object instanceof File) window.__intakePreviewNames.push(object.name);
      return createObjectURL(object);
    };
  });
}

async function rasterBytes(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'red';
    context.fillRect(0, 0, 2, 2);
    return {
      png: canvas.toDataURL('image/png').split(',')[1],
      jpg: canvas.toDataURL('image/jpeg').split(',')[1],
      webp: canvas.toDataURL('image/webp').split(',')[1],
    };
  });
  return {
    png: Buffer.from(encoded.png, 'base64'),
    jpg: Buffer.from(encoded.jpg, 'base64'),
    webp: Buffer.from(encoded.webp, 'base64'),
  };
}

test('rejects unknown, extensionless and prototype-property names before preview allocation', async ({ page }) => {
  await trackPreviews(page);
  await page.goto('/');
  const { png } = await rasterBytes(page);
  const names = ['unknown.txt', 'README', 'file.constructor', 'file.toString', 'file.__proto__'];
  // Even a valid image MIME and image bytes must not bypass source validation.
  await page.locator('input[type="file"]').setInputFiles(names.map((name) => ({
    name, mimeType: 'image/png', buffer: png,
  })));

  await expect(page.getByRole('alert')).toContainText('5 unsupported files rejected');
  await expect(page.getByRole('region', { name: /Format conversion queue/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__intakePreviewNames)).toEqual([]);
});

test('keeps valid mixed inputs in order, reports rejects, and converts with declared defaults', async ({ page }) => {
  await trackPreviews(page);
  await page.goto('/');
  const { png } = await rasterBytes(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'first.PNG', mimeType: 'image/png', buffer: png },
    { name: 'unknown.txt', mimeType: 'image/png', buffer: png },
    { name: 'second.SVG', mimeType: 'image/svg+xml', buffer: svg },
    { name: 'README', mimeType: 'image/png', buffer: png },
  ]);

  const queue = page.getByRole('region', { name: 'Format conversion queue (2)' });
  await expect(queue).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('2 unsupported files rejected');
  await expect(queue.getByRole('listitem').getByRole('heading')).toHaveText(['first.PNG', 'second.SVG']);
  await expect(page.getByLabel('Output for first.PNG')).toHaveValue('jpg');
  await expect(page.getByLabel('Output for second.SVG')).toHaveValue('png');
  expect(await page.evaluate(() => window.__intakePreviewNames)).toEqual(['first.PNG', 'second.SVG']);

  await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
  await expect(queue.getByRole('status', { name: 'Format conversion status' })).toContainText('2 completed · 0 failed', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Download first.jpg', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download second.png', exact: true })).toBeVisible();
});

test('assigns usable defaults to every registered source including uppercase JPEG and PDF', async ({ page }) => {
  await trackPreviews(page);
  await page.goto('/');
  const bytes = await rasterBytes(page);
  const pdf = await PDFDocument.create();
  pdf.addPage([8, 8]);
  const bmp = Buffer.alloc(58);
  bmp.write('BM', 0, 'ascii');
  bmp.writeUInt32LE(58, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(1, 18);
  bmp.writeInt32LE(1, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(4, 34);
  bmp.set([0, 0, 255, 0], 54);
  const files = [
    { name: 'image.PNG', mimeType: 'image/png', buffer: bytes.png, target: 'jpg' },
    { name: 'image.jpg', mimeType: 'image/jpeg', buffer: bytes.jpg, target: 'png' },
    { name: 'alias.JPEG', mimeType: 'image/jpeg', buffer: bytes.jpg, target: 'png' },
    { name: 'image.webp', mimeType: 'image/webp', buffer: bytes.webp, target: 'png' },
    { name: 'image.bmp', mimeType: 'image/bmp', buffer: bmp, target: 'png' },
    { name: 'image.SVG', mimeType: 'image/svg+xml', buffer: svg, target: 'png' },
    { name: 'document.PDF', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()), target: 'png' },
  ];
  await page.locator('input[type="file"]').setInputFiles(files.map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));

  const queue = page.getByRole('region', { name: 'Format conversion queue (7)' });
  await expect(queue).toBeVisible();
  for (const { name, target } of files) {
    const output = page.getByLabel(`Output for ${name}`);
    await expect(output).toHaveValue(target);
    await expect(output.locator(`option[value="${target}"]`)).toHaveCount(1);
  }
  await expect(page.getByLabel('PDF page for document.PDF')).toBeEnabled({ timeout: 60_000 });
  expect(await page.evaluate(() => window.__intakePreviewNames)).toEqual(files.slice(0, 6).map((file) => file.name));
  await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
  await expect(queue.getByRole('status', { name: 'Format conversion status' })).toContainText('7 completed · 0 failed', { timeout: 60_000 });
});
