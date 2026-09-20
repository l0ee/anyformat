import { expect, test, type Locator } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';

declare global {
  interface Window {
    __pdfPreviewImageUrls: string[];
    __revokedObjectUrls: string[];
    __racePreviewReadStarted?: boolean;
    __releaseRacePreviewRead?: () => void;
  }
}

async function createTwoPageColorPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage([100, 100]).drawRectangle({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: rgb(1, 0, 0),
  });
  document.addPage([100, 100]).drawRectangle({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: rgb(0, 0, 1),
  });
  return Buffer.from(await document.save());
}

async function centerPixel(image: Locator): Promise<number[]> {
  return image.evaluate(async (element) => {
    const source = element as HTMLImageElement;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(source, 0, 0);
    const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  });
}

test('lazily previews the selected PDF page and invalidates stale previews', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = window;
    probe.__pdfPreviewImageUrls = [];
    probe.__revokedObjectUrls = [];

    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      const url = createObjectURL(object);
      if (object instanceof Blob && object.type === 'image/png') {
        probe.__pdfPreviewImageUrls.push(url);
      }
      return url;
    };

    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      probe.__revokedObjectUrls.push(url);
      revokeObjectURL(url);
    };

    const originalArrayBuffer = File.prototype.arrayBuffer;
    const readCounts = new WeakMap<File, number>();
    File.prototype.arrayBuffer = function () {
      const readCount = (readCounts.get(this) ?? 0) + 1;
      readCounts.set(this, readCount);

      // Hold a repeated preview of page two after its previous preview exists,
      // so the test can switch pages before this render completes.
      if (this.name === 'race.pdf' && readCount === 4) {
        probe.__racePreviewReadStarted = true;
        return new Promise<ArrayBuffer>((resolve, reject) => {
          probe.__releaseRacePreviewRead = () => {
            originalArrayBuffer.call(this).then(resolve, reject);
          };
        });
      }

      return originalArrayBuffer.call(this);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  const fileInput = page.locator('input[type="file"]');
  const pdf = await createTwoPageColorPdf();
  await fileInput.setInputFiles({ name: 'race.pdf', mimeType: 'application/pdf', buffer: pdf });

  const raceItem = page.locator('li').filter({ hasText: 'race.pdf' });
  const pageInput = page.getByLabel('PDF page for race.pdf');
  await expect(pageInput).toBeVisible({ timeout: 60_000 });
  await expect(pageInput).toHaveAttribute('max', '2', { timeout: 60_000 });
  await expect(raceItem.getByRole('img', { name: /Source page preview for race\.pdf/ })).toHaveCount(0);

  await raceItem.getByRole('button', { name: 'Preview source page' }).click();
  const pageOnePreview = raceItem.getByRole('img', { name: 'Source page preview for race.pdf, page 1' });
  await expect(pageOnePreview).toBeVisible({ timeout: 60_000 });
  const pageOneUrl = await pageOnePreview.getAttribute('src');
  expect(pageOneUrl).toBeTruthy();
  const redPixel = await centerPixel(pageOnePreview);
  expect(redPixel[0]).toBeGreaterThan(200);
  expect(redPixel[2]).toBeLessThan(50);

  await pageInput.fill('2');
  await expect(pageInput).toHaveValue('2');
  await expect(pageOnePreview).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__revokedObjectUrls)).toContain(pageOneUrl);

  const sourcePreviewButton = raceItem.getByRole('button', { name: 'Preview source page' });
  await sourcePreviewButton.click();
  const pageTwoPreview = raceItem.getByRole('img', { name: 'Source page preview for race.pdf, page 2' });
  await expect(pageTwoPreview).toBeVisible({ timeout: 60_000 });
  const pageTwoUrl = await pageTwoPreview.getAttribute('src');
  expect(pageTwoUrl).toBeTruthy();
  const bluePixel = await centerPixel(pageTwoPreview);
  expect(bluePixel[0]).toBeLessThan(50);
  expect(bluePixel[2]).toBeGreaterThan(200);

  await sourcePreviewButton.click();
  await page.waitForFunction(() => window.__racePreviewReadStarted === true);
  await expect(raceItem.getByText('Rendering PDF page 2 preview…')).toBeVisible();

  await pageInput.fill('1');
  await expect(pageInput).toHaveValue('1');
  await expect(pageTwoPreview).toHaveCount(0);
  const replacementPageOnePreview = raceItem.getByRole('img', {
    name: 'Source page preview for race.pdf, page 1',
  });
  await raceItem.getByRole('button', { name: 'Preview source page' }).click();
  await expect(replacementPageOnePreview).toBeVisible({ timeout: 60_000 });
  const replacementPageOneUrl = await replacementPageOnePreview.getAttribute('src');
  expect(replacementPageOneUrl).toBeTruthy();
  const replacementRedPixel = await centerPixel(replacementPageOnePreview);
  expect(replacementRedPixel[0]).toBeGreaterThan(200);
  expect(replacementRedPixel[2]).toBeLessThan(50);

  await page.evaluate(() => window.__releaseRacePreviewRead?.());
  await expect.poll(() => page.evaluate(() => window.__pdfPreviewImageUrls.length)).toBe(4);
  const stalePageTwoUrl = await page.evaluate(() => window.__pdfPreviewImageUrls[3]);
  await expect.poll(() => page.evaluate(() => window.__revokedObjectUrls)).toContain(stalePageTwoUrl);
  await expect(replacementPageOnePreview).toHaveAttribute('src', replacementPageOneUrl!);
  const currentRedPixel = await centerPixel(replacementPageOnePreview);
  expect(currentRedPixel[0]).toBeGreaterThan(200);
  expect(currentRedPixel[2]).toBeLessThan(50);

  await raceItem.getByRole('button', { name: 'Remove race.pdf from conversion queue' }).click();
  await expect(page.getByRole('heading', { name: 'Format conversion queue (0)' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__revokedObjectUrls)).toContain(replacementPageOneUrl);

  await fileInput.setInputFiles({ name: 'clear.pdf', mimeType: 'application/pdf', buffer: pdf });
  const clearItem = page.locator('li').filter({ hasText: 'clear.pdf' });
  await expect(page.getByLabel('PDF page for clear.pdf')).toBeVisible({ timeout: 60_000 });
  await clearItem.getByRole('button', { name: 'Preview source page' }).click();
  const clearPreview = clearItem.getByRole('img', { name: 'Source page preview for clear.pdf, page 1' });
  await expect(clearPreview).toBeVisible({ timeout: 60_000 });
  const clearPreviewUrl = await clearPreview.getAttribute('src');
  expect(clearPreviewUrl).toBeTruthy();

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('heading', { name: 'Format conversion queue (1)' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__revokedObjectUrls)).toContain(clearPreviewUrl);
});
