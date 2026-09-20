import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

interface PreviewUrlTracking {
  created: string[];
  revoked: string[];
}

declare global {
  interface Window {
    __comparisonSliderPreviewUrls?: PreviewUrlTracking;
  }
}

test('keeps the comparison slider accessible and cleans up SVG preview URLs', async ({ page }) => {
  await page.addInitScript(() => {
    const tracking: PreviewUrlTracking = { created: [], revoked: [] };
    window.__comparisonSliderPreviewUrls = tracking;

    const urlApi = URL as typeof URL & {
      createObjectURL: (object: Blob | MediaSource) => string;
      revokeObjectURL: (url: string) => void;
    };
    const nativeCreateObjectURL = urlApi.createObjectURL.bind(urlApi);
    const nativeRevokeObjectURL = urlApi.revokeObjectURL.bind(urlApi);

    urlApi.createObjectURL = (object) => {
      const url = nativeCreateObjectURL(object);
      if (object instanceof Blob && object.type === 'image/svg+xml') {
        tracking.created.push(url);
      }
      return url;
    };
    urlApi.revokeObjectURL = (url) => {
      tracking.revoked.push(url);
      nativeRevokeObjectURL(url);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Vector Studio/i }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'comparison.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });

  const comparison = page.locator('figure[aria-label="Original and vector image comparison"]');
  await expect(comparison).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('img[alt="Vector SVG preview"]')).toHaveAttribute('src', /^blob:/, { timeout: 60_000 });

  const slider = page.getByRole('slider', { name: 'Comparison position' });
  await expect(slider).toHaveValue('50');

  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('51');
  await expect(slider).toHaveAttribute('aria-valuetext', '51% original, 49% vector');
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await slider.press('Home');
  await expect(slider).toHaveValue('0');

  await comparison.scrollIntoViewIfNeeded();
  const box = await comparison.boundingBox();
  expect(box).not.toBeNull();
  const targetX = box!.x + box!.width * 0.75;
  const targetY = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width / 2, targetY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY);
  await page.mouse.up();
  await expect(slider).toHaveValue(String(Math.round(((targetX - box!.x) / box!.width) * 100)));

  const createdUrls = await page.evaluate(() => window.__comparisonSliderPreviewUrls?.created ?? []);
  expect(createdUrls.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Change File' }).click();
  await expect(comparison).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => {
    const tracking = window.__comparisonSliderPreviewUrls;
    return Boolean(tracking && tracking.created.every((url) => tracking.revoked.includes(url)));
  })).toBe(true);
});
