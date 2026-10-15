import { expect, test } from '@playwright/test';

for (const workspace of ['converter', 'studio', 'batch'] as const) {
  test(`rejects oversized image headers before creating ${workspace} preview URLs`, async ({ page }) => {
    await page.addInitScript(() => {
      const probe = window as unknown as { oversizedPreviewCreated: boolean };
      probe.oversizedPreviewCreated = false;
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object) => {
        if (object instanceof File && object.name === 'oversized.png') probe.oversizedPreviewCreated = true;
        return create(object);
      };
    });
    await page.goto('/');
    if (workspace !== 'converter') await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
    if (workspace === 'batch') await page.getByRole('button', { name: 'Work with multiple images', exact: true }).click();
    const bytes = Buffer.alloc(24);
    bytes.writeUInt32BE(0x89504e47, 0);
    bytes.writeUInt32BE(0x0d0a1a0a, 4);
    bytes.writeUInt32BE(20000, 16);
    bytes.writeUInt32BE(20000, 20);
    await page.locator('input[type=file]').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: bytes });
    await expect(page.getByRole('alert')).toContainText(/exceed maximum allowable size/);
    expect(await page.evaluate(() => (window as unknown as { oversizedPreviewCreated: boolean }).oversizedPreviewCreated)).toBe(false);
    await expect(page.getByRole('heading', { name: 'oversized.png', exact: true })).toHaveCount(0);
  });
}

test('clearing the queue cancels an intake whose header read is pending', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('input[type=file]');
  await input.setInputFiles({
    name: 'initial.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'),
  });
  await expect(page.getByRole('heading', { name: 'initial.svg', exact: true })).toBeVisible();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=', 'base64');
  await page.evaluate((length) => {
    const probe = window as unknown as { headerReadStarted?: boolean; releaseHeaderRead?: () => void; pendingPreviewCreated?: boolean };
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      if (this.size !== length) return read.call(this);
      probe.headerReadStarted = true;
      return new Promise<ArrayBuffer>((resolve, reject) => {
        probe.releaseHeaderRead = () => { read.call(this).then(resolve, reject); };
      });
    };
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      if (object instanceof File && object.name === 'pending.png') probe.pendingPreviewCreated = true;
      return create(object);
    };
  }, png.length);
  await input.setInputFiles({ name: 'pending.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => (window as unknown as { headerReadStarted?: boolean }).headerReadStarted);
  await page.getByRole('button', { name: 'Clear all files from the format conversion queue' }).click();
  await page.evaluate(() => (window as unknown as { releaseHeaderRead: () => void }).releaseHeaderRead());
  // Flush the promise continuation and the ensuing render before checking cancellation.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', { name: 'pending.png', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { pendingPreviewCreated?: boolean }).pendingPreviewCreated)).toBeUndefined();
});
