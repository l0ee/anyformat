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

test('workspace shortcuts preserve the focused queue search', async ({ page }) => {
  await page.goto('/');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  await page.locator('input[type="file"]').setInputFiles(
    [1, 2, 3].map((index) => ({ name: `search-${index}.svg`, mimeType: 'image/svg+xml', buffer: svg })),
  );

  const search = page.getByLabel('Search queue');
  await search.fill('search-1');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('search-1');
  await expect(page.getByRole('button', { name: 'Convert files', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Convert files', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.getByRole('button', { name: 'Create SVG', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

for (const key of ['Tab', 'Shift+Tab']) {
  test(`help dialog recovers ${key} focus from outside and restores its opener`, async ({ page }) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
    const close = dialog.getByRole('button', { name: 'Close dialog' });
    await expect(close).toBeFocused();

    await page.getByRole('button', { name: 'Convert files', exact: true }).focus();
    await page.keyboard.press(key);
    await expect(close).toBeFocused();
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press(key);
      await expect(close).toBeFocused();
    }

    await dialog.locator('[tabindex="-1"]').focus();
    await page.keyboard.press(key);
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}

test('help dialog retains its original focus restoration target across app updates', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true });
  await opener.click();
  const close = page.getByRole('button', { name: 'Close dialog' });
  await expect(close).toBeFocused();

  await page.keyboard.press('Shift+T');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(close).toBeFocused();
  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
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
  await page.getByRole('button', { name: 'Convert files', exact: true }).click();
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
