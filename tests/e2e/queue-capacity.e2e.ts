import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

declare global {
  interface Window {
    __queueObjectUrlFileNames: string[];
    __fileArrayBufferReads: string[];
  }
}

const validSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#e11d48"/></svg>',
);

async function createPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage([8, 8]);
  return Buffer.from(await document.save());
}

async function createPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#e11d48';
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

function imageFiles(prefix: string, count: number, buffer: Buffer) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix}-${index}.png`,
    mimeType: 'image/png',
    buffer,
  }));
}

async function trackQueueSideEffects(page: Page) {
  await page.addInitScript(() => {
    window.__queueObjectUrlFileNames = [];
    window.__fileArrayBufferReads = [];

    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      const url = createObjectURL(object);
      if (object instanceof File) window.__queueObjectUrlFileNames.push(object.name);
      return url;
    };

    const arrayBuffer = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function (this: File) {
      window.__fileArrayBufferReads.push(this.name);
      return arrayBuffer.call(this);
    };
  });
}

test('caps repeated legacy batch additions at 100 and reports skipped files', async ({ page }) => {
  await trackQueueSideEffects(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Vector Batch|SVG Batch/i }).click();

  const png = await createPng(page);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(imageFiles('batch', 99, png));
  await expect(page.getByRole('heading', { name: 'Batch queue (99 files)' })).toBeVisible();

  await fileInput.setInputFiles([
    { name: 'batch-accepted.png', mimeType: 'image/png', buffer: png },
    { name: 'batch-over-cap.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.getByRole('heading', { name: 'Batch queue (100 files)' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Accepted 1 image; skipped 1 file (1 over the 100-file queue limit).',
  );

  await fileInput.setInputFiles({ name: 'batch-at-cap.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('alert')).toHaveText(
    'Accepted 0 images; skipped 1 file (1 over the 100-file queue limit).',
  );
  await expect(page.getByRole('heading', { name: 'Batch queue (100 files)' })).toBeVisible();

  const objectUrlFileNames = await page.evaluate(() => window.__queueObjectUrlFileNames);
  expect(objectUrlFileNames).toHaveLength(100);
  expect(objectUrlFileNames).toContain('batch-accepted.png');
  expect(objectUrlFileNames).not.toContain('batch-over-cap.png');
  expect(objectUrlFileNames).not.toContain('batch-at-cap.png');
});

test('caps repeated Universal additions and skips object URLs and PDF page counting at capacity', async ({ page }) => {
  await trackQueueSideEffects(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();

  const png = await createPng(page);
  const pdf = await createPdf();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(imageFiles('universal', 98, png));
  await expect(page.getByRole('heading', { name: 'Format conversion queue (98)' })).toBeVisible();

  await fileInput.setInputFiles([
    { name: 'accepted.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: 'accepted.svg', mimeType: 'image/svg+xml', buffer: validSvg },
    { name: 'over-cap.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: 'over-cap.svg', mimeType: 'image/svg+xml', buffer: validSvg },
  ]);
  await expect(page.getByRole('heading', { name: 'Format conversion queue (100)' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Accepted 2 files; skipped 2 files (2 over the 100-file queue limit).',
  );
  await expect(page.getByLabel('PDF page for accepted.pdf')).toBeVisible({ timeout: 60_000 });

  await fileInput.setInputFiles({ name: 'at-capacity.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByRole('alert')).toHaveText(
    'Accepted 0 files; skipped 1 file (1 over the 100-file queue limit).',
  );
  await expect(page.getByRole('heading', { name: 'Format conversion queue (100)' })).toBeVisible();

  const sideEffects = await page.evaluate(() => ({
    objectUrlFileNames: window.__queueObjectUrlFileNames,
    fileArrayBufferReads: window.__fileArrayBufferReads,
  }));
  expect(sideEffects.objectUrlFileNames).toHaveLength(99);
  expect(sideEffects.objectUrlFileNames).toContain('accepted.svg');
  expect(sideEffects.objectUrlFileNames).not.toContain('over-cap.svg');
  expect(sideEffects.objectUrlFileNames).not.toContain('at-capacity.pdf');
  expect(sideEffects.fileArrayBufferReads).toEqual(['accepted.pdf']);
});
