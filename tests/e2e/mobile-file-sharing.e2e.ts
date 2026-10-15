import { expect, Page, test } from '@playwright/test';

type Probe = Window & {
  shareProbe: {
    files: File[];
    keys: string[][];
    activated: boolean[];
    mode: 'resolve' | 'hold' | 'cancel' | 'fail';
    release?: () => void;
    revoked: string[];
    encoders: (() => void)[];
  };
};

async function mockSharing(page: Page, platform: 'ios' | 'ipad' | 'android' | 'other' = 'other', supported = true) {
  await page.addInitScript(({ platform, supported }) => {
    const probe = (window as Probe).shareProbe = { files: [], keys: [], activated: [], mode: 'resolve', revoked: [], encoders: [] };
    const userAgent = platform === 'ios' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
      : platform === 'ipad' ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15'
      : platform === 'android' ? 'Mozilla/5.0 (Linux; Android 15; Pixel 8)' : 'Desktop browser';
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: platform === 'other' ? 0 : 5 });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }: ShareData) => supported && !!files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: (data: ShareData) => {
      probe.files.push(...data.files!);
      probe.keys.push(Object.keys(data));
      probe.activated.push(navigator.userActivation.isActive);
      if (!navigator.userActivation.isActive) return Promise.reject(new DOMException('Need tap', 'NotAllowedError'));
      if (probe.mode === 'cancel') return Promise.reject(new DOMException('Dismissed', 'AbortError'));
      if (probe.mode === 'fail') return Promise.reject(new DOMException('Failed', 'DataError'));
      if (probe.mode === 'hold') return new Promise<void>((resolve) => { probe.release = resolve; });
      return Promise.resolve();
    } });
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => { probe.revoked.push(url); revoke(url); };
  }, { platform, supported });
}

async function png(page: Page, name = 'image.png') {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 32, 48);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

async function convertImage(page: Page, target = 'png') {
  await page.locator('input[type="file"]').setInputFiles(await png(page));
  await page.getByLabel('Output for image.png').selectOption(target);
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('status', { name: 'Format conversion status' })).toContainText('Conversion complete');
}

test('shares converted image bytes, handles cancellation/errors, and preserves download', async ({ page }) => {
  await mockSharing(page);
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(await png(page));
  await page.getByLabel('Output for image.png').selectOption('png');
  await page.getByText('Image settings', { exact: true }).click();
  await page.getByLabel('Width (px)').fill('32');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  const share = page.getByRole('button', { name: 'Share image.png', exact: true });
  await share.click();
  const shared = await page.evaluate(async () => {
    const probe = (window as Probe).shareProbe;
    const file = probe.files[0];
    const image = await createImageBitmap(file);
    const dimensions = [image.width, image.height];
    image.close();
    return { name: file.name, type: file.type, dimensions, keys: probe.keys[0], activated: probe.activated[0] };
  });
  expect(shared).toEqual({ name: 'image.png', type: 'image/png', dimensions: [32, 24], keys: ['files'], activated: true });
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.evaluate(() => { (window as Probe).shareProbe.mode = 'cancel'; });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(downloads).toBe(0);
  await page.evaluate(() => { (window as Probe).shareProbe.mode = 'fail'; });
  await share.click();
  await expect(page.getByRole('alert')).toContainText('Could not open file sharing');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image.png', exact: true }).click();
  expect((await pending).suggestedFilename()).toBe('image.png');
});

test('blocks overlapping share menus across completed batch results', async ({ page }) => {
  await mockSharing(page);
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles([await png(page, 'first.png'), await png(page, 'second.png')]);
  await page.getByLabel('Convert all to').selectOption('png');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(2);
  await page.evaluate(() => { (window as Probe).shareProbe.mode = 'hold'; });
  const first = page.getByRole('button', { name: 'Share first.png', exact: true });
  const second = page.getByRole('button', { name: 'Share second.png', exact: true });
  await first.click();
  await expect(first).toBeDisabled();
  await expect(second).toBeDisabled();
  await page.evaluate(() => (window as Probe).shareProbe.release!());
  await expect(second).toBeEnabled();
  await page.evaluate(() => { (window as Probe).shareProbe.mode = 'resolve'; });
  await second.click();
  expect(await page.evaluate(() => (window as Probe).shareProbe.files.map((file) => file.name))).toEqual(['first.png', 'second.png']);
  await expect(page.getByRole('status', { name: 'Format conversion status' })).toContainText('2 completed');
});

test('unsupported sharing keeps download and manual attachment guidance', async ({ page }) => {
  await mockSharing(page, 'other', false);
  await page.goto('/');
  await convertImage(page);
  await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0);
  await page.getByText('Sharing help', { exact: true }).click();
  await expect(page.getByText(/File sharing isn’t available/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image.png', exact: true }).click();
  expect((await pending).suggestedFilename()).toBe('image.png');
});

for (const platform of ['ios', 'ipad'] as const) {
  test(`${platform} photo preview preserves native gestures, focus, URLs and invalidation`, async ({ page }) => {
    await mockSharing(page, platform);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await convertImage(page);
    const opener = page.getByRole('button', { name: 'Save image.png to Photos…', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Save image to Photos', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Touch and hold the image/)).toBeVisible();
    const image = dialog.getByAltText('Image to save: image.png');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(64);
    const url = await image.getAttribute('src');
    expect(await image.evaluate((img) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      return event.defaultPrevented;
    })).toBe(false);
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Share image.png', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => (window as Probe).shareProbe.revoked)).toContain(url);

    await opener.click();
    const changedUrl = await dialog.getByAltText('Image to save: image.png').getAttribute('src');
    // Simulate an external result edit while the preview is open.
    await page.getByRole('button', { name: 'Reset image settings', includeHidden: true }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(dialog).toHaveCount(0);
    await expect(opener).toHaveCount(0);
    expect(await page.evaluate(() => (window as Probe).shareProbe.revoked)).toContain(changedUrl);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Android saves images with download-location guidance and keeps PDFs as files', async ({ page }) => {
  await mockSharing(page, 'android');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await convertImage(page, 'jpg');
  await expect(page.getByRole('button', { name: /to Photos/ })).toHaveCount(0);
  await expect(page.getByText(/Check Downloads or Files/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image image.jpg', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('image.jpg');
  await page.getByRole('button', { name: 'Share image.jpg', exact: true }).click();
  expect(await page.evaluate(() => (window as Probe).shareProbe.files[0].type)).toBe('image/jpeg');
  await page.getByRole('button', { name: 'Convert another file' }).click();
  await convertImage(page, 'pdf');
  await expect(page.getByRole('button', { name: /^Save image / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Share image.pdf', exact: true }).click();
  expect(await page.evaluate(async () => {
    const file = (window as Probe).shareProbe.files[1];
    return { name: file.name, type: file.type, header: await file.slice(0, 4).text() };
  })).toEqual({ name: 'image.pdf', type: 'application/pdf', header: '%PDF' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('iOS PDFs offer file guidance and share without Photos actions', async ({ page }) => {
  await mockSharing(page, 'ios');
  await page.goto('/');
  await convertImage(page, 'pdf');
  await expect(page.getByRole('button', { name: /to Photos/ })).toHaveCount(0);
  await expect(page.getByText(/Find downloads in the Files app/)).toBeVisible();
  await page.getByRole('button', { name: 'Share image.pdf', exact: true }).click();
  expect(await page.evaluate(() => (window as Probe).shareProbe.files[0].name)).toBe('image.pdf');
  await expect(page.getByRole('button', { name: 'Download image.pdf', exact: true })).toBeVisible();
});

test('Studio prepares on demand, discards late exports, and shares with a fresh tap', async ({ page }) => {
  await mockSharing(page, 'ios');
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(await png(page));
  const prepare = page.getByRole('button', { name: 'Prepare image', exact: true });
  await expect(prepare).toBeEnabled();
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      (window as Probe).shareProbe.encoders.push(() => encode.call(this, callback, type, quality));
    };
  });
  await prepare.click();
  await expect.poll(() => page.evaluate(() => (window as Probe).shareProbe.encoders.length)).toBe(1);
  await page.getByLabel('Image scale', { exact: true }).selectOption('1');
  await prepare.click();
  await expect.poll(() => page.evaluate(() => (window as Probe).shareProbe.encoders.length)).toBe(2);
  await page.evaluate(() => (window as Probe).shareProbe.encoders[1]());
  const share = page.getByRole('button', { name: 'Share image@1x.png', exact: true });
  await expect(share).toBeVisible();
  await page.evaluate(() => (window as Probe).shareProbe.encoders[0]());
  await expect(page.getByRole('button', { name: 'Share image@2x.png', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as Probe).shareProbe.files.length)).toBe(0);
  await share.click();
  expect(await page.evaluate(() => (window as Probe).shareProbe.activated)).toEqual([true]);
  expect(await page.evaluate(async () => {
    const file = (window as Probe).shareProbe.files[0];
    const image = await createImageBitmap(file);
    const result = { name: file.name, type: file.type, width: image.width, height: image.height };
    image.close();
    return result;
  })).toEqual({ name: 'image@1x.png', type: 'image/png', width: 64, height: 48 });
  await page.getByText('SVG code and cleanup settings', { exact: true }).click();
  await page.getByLabel('Decimal places:').selectOption('3');
  await expect(share).toHaveCount(0);
  await expect(prepare).toBeEnabled();
  await page.getByLabel('Image format', { exact: true }).selectOption('webp');
  await prepare.click();
  await expect.poll(() => page.evaluate(() => (window as Probe).shareProbe.encoders.length)).toBe(3);
  await page.evaluate(() => (window as Probe).shareProbe.encoders[2]());
  await expect(page.getByRole('button', { name: /to Photos/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Share image@1x.webp', exact: true }).click();
  expect(await page.evaluate(() => (window as Probe).shareProbe.files[1].type)).toBe('image/webp');
});

test('Studio can retry failed preparation without opening a share menu', async ({ page }) => {
  await mockSharing(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(await png(page));
  const prepare = page.getByRole('button', { name: 'Prepare image', exact: true });
  await expect(prepare).toBeEnabled();
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    let fail = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (fail) { fail = false; callback(null); }
      else encode.call(this, callback, type, quality);
    };
  });
  await prepare.click();
  await expect(page.getByRole('alert')).toContainText('Could not prepare this image');
  await prepare.click();
  await expect(page.getByRole('button', { name: 'Share image@2x.png', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Probe).shareProbe.files.length)).toBe(0);
});
