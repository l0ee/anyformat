import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

type PdfRaceProbe = Window & {
  __pageCountReadStarted?: boolean;
  __releasePageCount?: () => void;
  __pdfBlobReady?: boolean;
  __releasePdfBlob?: () => void;
};

async function createPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage([100, 100]);
  document.addPage([120, 100]);
  return Buffer.from(await document.save());
}

test('keyboard shortcuts toggle one accessible help dialog', async ({ page }) => {
  await page.goto('/');

  const dialogs = page.getByRole('dialog');
  await expect(dialogs).toHaveCount(0);

  await page.keyboard.press('?');
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs).toHaveAccessibleName('Keyboard Shortcuts');

  await page.keyboard.press('?');
  await expect(dialogs).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(dialogs).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await expect(dialogs).toHaveCount(0);
});

test('preserves PDF page metadata when its count resolves during conversion', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = window as PdfRaceProbe;
    const originalArrayBuffer = File.prototype.arrayBuffer;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    let isFirstFileRead = true;

    File.prototype.arrayBuffer = function () {
      if (!isFirstFileRead) return originalArrayBuffer.call(this);
      isFirstFileRead = false;
      probe.__pageCountReadStarted = true;

      return new Promise<ArrayBuffer>((resolve, reject) => {
        probe.__releasePageCount = () => {
          originalArrayBuffer.call(this).then(resolve, reject);
        };
      });
    };

    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      originalToBlob.call(this, (blob) => {
        probe.__pdfBlobReady = true;
        probe.__releasePdfBlob = () => callback(blob);
      }, type, quality);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: await createPdf(),
  });

  await page.waitForFunction(() => (window as PdfRaceProbe).__pageCountReadStarted === true);
  await expect(page.getByText('Reading PDF pages…')).toBeVisible();

  await page.getByRole('button', { name: 'Convert all files' }).click();
  await page.waitForFunction(() => (window as PdfRaceProbe).__pdfBlobReady === true, null, {
    timeout: 60_000,
  });

  await page.evaluate(() => (window as PdfRaceProbe).__releasePageCount?.());
  const pageInput = page.getByLabel('PDF page for sample.pdf');
  await expect(pageInput).toBeVisible({ timeout: 60_000 });
  await expect(pageInput).toHaveAttribute('max', '2');

  await page.evaluate(() => (window as PdfRaceProbe).__releasePdfBlob?.());
  await expect(page.getByText('1 completed of 1')).toBeVisible({ timeout: 60_000 });
  await expect(pageInput).toHaveAttribute('max', '2');
});
