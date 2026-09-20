import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __revokedObjectUrls: string[];
  }
}

const validSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#e11d48"/></svg>',
);

test('clears completed conversions, preserves other work, and releases completed object URLs', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.__revokedObjectUrls = [];
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__revokedObjectUrls.push(url);
      revokeObjectURL(url);
    };

    // Keep the second conversion in-flight long enough to verify the bulk
    // action is disabled while a completed result is still in the queue.
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      toBlob.call(this, (blob) => window.setTimeout(() => callback(blob), 350), type, quality);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    { name: 'completed.svg', mimeType: 'image/svg+xml', buffer: validSvg },
    { name: 'failed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF document') },
  ]);

  await expect(page.getByRole('heading', { name: 'Format conversion queue (2)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Clear completed/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Convert all files/ }).click();
  await expect(page.getByText(/^Failed:/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Retry failed files' }).first().click();
  await expect(page.getByText('1 completed, 1 failed of 2')).toBeVisible({ timeout: 60_000 });

  const completedItem = page.locator('li').filter({ hasText: 'completed.svg' });
  await completedItem.getByRole('button', { name: 'Preview' }).click();
  const completedSourceUrl = await completedItem
    .getByRole('img', { name: 'Source preview for completed.svg' })
    .getAttribute('src');
  const completedResultUrl = await completedItem
    .getByRole('img', { name: 'Converted preview for completed.svg' })
    .getAttribute('src');
  expect(completedSourceUrl).toBeTruthy();
  expect(completedResultUrl).toBeTruthy();

  await fileInput.setInputFiles({
    name: 'processing.svg',
    mimeType: 'image/svg+xml',
    buffer: validSvg,
  });
  await expect(page.getByRole('heading', { name: 'Format conversion queue (3)' })).toBeVisible();

  const clearCompleted = page.getByRole('button', { name: 'Clear completed (1)' });
  await expect(clearCompleted).toBeEnabled();
  await page.getByRole('button', { name: /Convert all files/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Converting processing.svg' })).toBeVisible();
  await expect(clearCompleted).toBeDisabled();
  await expect(page.getByText('2 completed, 1 failed of 3')).toBeVisible({ timeout: 60_000 });

  await fileInput.setInputFiles({
    name: 'idle.svg',
    mimeType: 'image/svg+xml',
    buffer: validSvg,
  });
  await expect(page.getByRole('heading', { name: 'Format conversion queue (4)' })).toBeVisible();

  const idleItem = page.locator('li').filter({ hasText: 'idle.svg' });
  await idleItem.getByRole('button', { name: 'Preview' }).click();
  const idleSourceUrl = await idleItem
    .getByRole('img', { name: 'Source preview for idle.svg' })
    .getAttribute('src');
  expect(idleSourceUrl).toBeTruthy();

  await page.getByRole('button', { name: 'Clear completed (2)' }).click();

  await expect(page.getByRole('heading', { name: 'Format conversion queue (2)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'failed.pdf' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'idle.svg' })).toBeVisible();
  await expect(page.getByText(/^Failed:/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Clear completed/ })).toHaveCount(0);

  const revokedObjectUrls = await page.evaluate(() => window.__revokedObjectUrls);
  expect(revokedObjectUrls).toContain(completedSourceUrl);
  expect(revokedObjectUrls).toContain(completedResultUrl);
  expect(revokedObjectUrls).not.toContain(idleSourceUrl);
});
