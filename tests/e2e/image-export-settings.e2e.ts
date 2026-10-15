import { expect, Page, test } from '@playwright/test';

async function createImage(page: Page, name = 'resize.png') {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    return canvas.toDataURL().split(',')[1];
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test('resizes same-format images and invalidates output when settings change', async ({ page }) => {
  await page.goto('/');
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('input[type="file"]').setInputFiles({ name: 'resize.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await page.getByLabel('Output for resize.png').selectOption('png');
  await page.getByText('Image settings', { exact: true }).click();
  await page.getByLabel('Width (px)').fill('160');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  const downloadButton = page.getByRole('button', { name: 'Download resize.png', exact: true });
  await expect(downloadButton).toBeVisible();
  const pending = page.waitForEvent('download');
  await downloadButton.click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw new Error('Missing download stream');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const output = Buffer.concat(chunks);
  expect(output.readUInt32BE(16)).toBe(160);
  expect(output.readUInt32BE(20)).toBe(120);
  await page.getByLabel('Width (px)').fill('80');
  await expect(downloadButton).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Convert all files' })).toBeEnabled();
  await page.getByLabel('Output for resize.png').selectOption('jpg');
  await page.getByLabel('JPEG background').fill('#ff0000');
  await page.getByRole('slider', { name: /Quality/ }).fill('75');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  const jpegDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download resize.jpg', exact: true }).click();
  const jpegStream = await (await jpegDownload).createReadStream();
  if (!jpegStream) throw new Error('Missing JPEG stream');
  const jpegChunks: Buffer[] = [];
  for await (const chunk of jpegStream) jpegChunks.push(Buffer.from(chunk));
  const pixel = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, Buffer.concat(jpegChunks).toString('base64'));
  expect(pixel[0]).toBeGreaterThan(240);
  expect(pixel[1]).toBeLessThan(10);
  expect(pixel[2]).toBeLessThan(10);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const resultUrl = await page.getByAltText('Converted preview for resize.png').getAttribute('src');
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    Object.assign(window, { revokedUrls: [] as string[] });
    URL.revokeObjectURL = (url) => {
      (window as unknown as { revokedUrls: string[] }).revokedUrls.push(url);
      revoke(url);
    };
  });
  await page.getByRole('button', { name: 'Reset image settings' }).click();
  await expect(page.getByLabel('Width (px)')).toHaveValue('');
  await expect(page.getByLabel('Height (px)')).toHaveValue('');
  await expect(page.getByRole('slider', { name: /Quality/ })).toHaveValue('92');
  await expect(page.getByLabel('JPEG background')).toHaveValue('#ffffff');
  await expect(page.getByAltText('Converted preview for resize.png')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { revokedUrls: string[] }).revokedUrls)).toContain(resultUrl);
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByText('Output: 400 × 300 px', { exact: true })).toBeVisible();
});

test('validates dimensions inline and blocks invalid bulk settings and keyboard conversion', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(await createImage(page));
  await page.getByLabel('Output for resize.png').selectOption('png');
  await page.getByText('Image settings', { exact: true }).click();
  for (const value of ['0', '-10', '1.5']) {
    await page.getByLabel('Width (px)').fill(value);
    await expect(page.getByLabel('Width (px)')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Width must be a positive whole number.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Convert all files' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Apply to compatible files' })).toBeDisabled();
  }
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Fix image settings for resize.png before converting.', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Format conversion status' })).toContainText('Ready to convert');
  await page.getByRole('button', { name: 'Reset image settings' }).click();
  await expect(page.getByLabel('Width (px)')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByRole('button', { name: 'Convert all files' })).toBeEnabled();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('button', { name: 'Download resize.png', exact: true })).toBeVisible();
});

test('applies image settings only to compatible jobs and clears their completed results', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles([
    await createImage(page, 'first.png'), await createImage(page, 'second.png'),
    { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>') },
  ]);
  await page.getByLabel('Convert all to').selectOption('png');
  const first = page.locator('li').filter({ has: page.getByRole('heading', { name: 'first.png', exact: true }) });
  const second = page.locator('li').filter({ has: page.getByRole('heading', { name: 'second.png', exact: true }) });
  await first.getByText('Image settings', { exact: true }).click();
  await first.getByLabel('Width (px)').fill('80');
  await first.getByRole('button', { name: 'Apply to compatible files' }).click();
  await second.getByText('Image settings', { exact: true }).click();
  await expect(second.getByLabel('Width (px)')).toHaveValue('80');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(3);
  await first.getByLabel('Width (px)').fill('40');
  await first.getByRole('button', { name: 'Apply to compatible files' }).click();
  await expect(page.getByRole('button', { name: 'Download first.png', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download second.png', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download vector.png', exact: true })).toBeVisible();
  await expect(second.getByLabel('Width (px)')).toHaveValue('40');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(first.getByText('Output: 40 × 30 px', { exact: true })).toBeVisible();
  await expect(second.getByText('Output: 40 × 30 px', { exact: true })).toBeVisible();
});

test('single-file primary action retries an encoder failure', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(await createImage(page));
  await page.getByLabel('Output for resize.png').selectOption('png');
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    let failed = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (!failed) {
        failed = true;
        callback(null);
      } else encode.call(this, callback, type, quality);
    };
  });
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('status', { name: 'Format conversion status' })).toContainText('Conversion failed');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: 'Download resize.png', exact: true })).toBeVisible();
});
