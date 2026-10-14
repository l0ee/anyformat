import { expect, test } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('mobile workspace presents two modes and an upload action on the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Convert files. Keep them private.');
  await expect(page.getByRole('navigation', { name: 'Conversion modes' }).getByRole('button')).toHaveCount(2);
  const upload = page.getByText('Choose files', { exact: true });
  const bounds = await upload.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(844);
  await expect(page.locator('[data-animation]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const chooser = page.waitForEvent('filechooser');
  await upload.click();
  await chooser;
});

test('multiple SVG inputs automatically open the batch workflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: png },
    { name: 'second.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.getByRole('heading', { name: 'Batch queue (2 files)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Batch settings' })).toBeVisible();
  await expect(page.getByLabel('Remove small specks')).toBeVisible();
  await expect(page.getByLabel('Corner smoothing')).toBeHidden();
  await page.getByText('Advanced settings', { exact: true }).click();
  await expect(page.getByLabel('Corner smoothing')).toBeVisible();
});

test('single-image preview and downloads stay visible while SVG code is collapsed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('slider', { name: 'Comparison position' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'DOWNLOAD OPTIMIZED SVG' })).toBeVisible();
  await expect(page.getByLabel('Optimized SVG source code')).toBeHidden();
  await page.getByText('SVG code and cleanup settings', { exact: true }).click();
  await expect(page.getByLabel('Optimized SVG source code')).toBeVisible();
});

test('conversion illustration can pause and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const curve = page.locator('.motion-curve');
  await expect(curve).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Pause illustration animation' }).click();
  await expect(curve).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Resume illustration animation' }).click();
  await expect(curve).toHaveCSS('animation-play-state', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(curve).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.motion-graphic-toggle')).toBeHidden();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose files', { exact: true }).click();
  await chooser;
});
