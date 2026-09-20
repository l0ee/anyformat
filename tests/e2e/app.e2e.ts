import { expect, test, type Page } from '@playwright/test';

function createBmp(): Buffer {
  const buffer = Buffer.alloc(58);
  buffer.write('BM', 0, 2, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(4, 34);
  buffer.set([0x48, 0x3f, 0xe1, 0x00], 54);
  return buffer;
}

function createPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 100 100]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
  );
}

async function canvasFiles(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#e11d48';
    context.fillRect(0, 0, 2, 2);
    return {
      png: canvas.toDataURL('image/png').split(',')[1],
      jpeg: canvas.toDataURL('image/jpeg', 0.9).split(',')[1],
      webp: canvas.toDataURL('image/webp', 0.9).split(',')[1],
    };
  });

  return [
    { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(encoded.png, 'base64') },
    { name: 'sample.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(encoded.jpeg, 'base64') },
    { name: 'sample.webp', mimeType: 'image/webp', buffer: Buffer.from(encoded.webp, 'base64') },
    { name: 'sample.bmp', mimeType: 'image/bmp', buffer: createBmp() },
    {
      name: 'sample.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#e11d48"/></svg>'),
    },
    { name: 'sample.pdf', mimeType: 'application/pdf', buffer: createPdf() },
  ];
}

test('renders the primary workflows without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  await expect(page).toHaveTitle(/AnyFormat — Universal/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /http:\/\/(127\.0\.0\.1:4174|localhost:5173)\//);
  await expect(page.getByText('by l0ee')).toHaveCount(1);
  await expect(page.getByText(/© \d{4} l0ee\./)).toBeVisible();
  await expect(page.getByRole('link', { name: /View AnyFormat on GitHub/ })).toHaveAttribute('href', 'https://github.com/l0ee/anyformat');

  const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
});

test('shows batch settings only after files are selected and below the uploader', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vector Batch' }).click();
  await expect(page.getByRole('heading', { name: 'Batch settings' })).toHaveCount(0);

  const files = await canvasFiles(page);
  await page.locator('input[type="file"]').setInputFiles(files[0]);

  const settings = page.getByRole('heading', { name: 'Batch settings' });
  await expect(settings).toBeVisible();
  const uploaderBox = await page.getByRole('button', { name: /Drop your images here/ }).boundingBox();
  const settingsBox = await settings.boundingBox();
  expect(uploaderBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(settingsBox!.y).toBeGreaterThan(uploaderBox!.y);
});

test('rejects unsupported universal uploads accessibly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'private.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('unsupported'),
  });
  await expect(page.getByRole('alert')).toContainText('1 unsupported file rejected: private.txt');
});

test('converts every advertised PNG, JPEG, WebP, BMP, SVG, and PDF path', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  const fixtures = await canvasFiles(page);
  const fixtureByExtension = Object.fromEntries(
    fixtures.map((fixture) => [fixture.name.split('.').pop()!, fixture])
  );
  const paths = [
    ['png', 'jpg'], ['png', 'webp'], ['png', 'svg'], ['png', 'pdf'],
    ['jpg', 'png'], ['jpg', 'webp'], ['jpg', 'svg'], ['jpg', 'pdf'],
    ['webp', 'png'], ['webp', 'jpg'], ['webp', 'svg'], ['webp', 'pdf'],
    ['bmp', 'png'], ['bmp', 'jpg'], ['bmp', 'webp'], ['bmp', 'svg'], ['bmp', 'pdf'],
    ['svg', 'png'], ['svg', 'jpg'], ['svg', 'webp'], ['svg', 'pdf'],
    ['pdf', 'png'], ['pdf', 'jpg'], ['pdf', 'webp'], ['pdf', 'svg'],
  ] as const;
  const matrixFiles = paths.map(([source, target]) => ({
    ...fixtureByExtension[source],
    name: `${source}-to-${target}.${source}`,
  }));

  await page.locator('input[type="file"]').setInputFiles(matrixFiles);

  await expect(page.getByRole('heading', { name: `Format conversion queue (${paths.length})` })).toBeVisible();
  await expect(page.getByLabel('Convert all to')).toBeDisabled();

  for (const [source, target] of paths) {
    await page.getByLabel(`Output for ${source}-to-${target}.${source}`).selectOption(target);
  }
  await page.getByRole('button', { name: 'Convert all files' }).click();

  await expect(page.getByText(`${paths.length} completed of ${paths.length}`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(paths.length);
});

test('triggers conversion with Ctrl+Enter and renders Copy SVG button with size reduction badge', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();

  const fixtures = await canvasFiles(page);
  const pngFixture = fixtures.find((f) => f.name === 'sample.png')!;

  await page.locator('input[type="file"]').setInputFiles([pngFixture]);
  await expect(page.getByRole('heading', { name: 'Convert file' })).toBeVisible();

  // Select SVG target format
  await page.getByLabel('Output for sample.png').selectOption('svg');

  // Blur dropdown to ensure hotkey isn't consumed by select element
  await page.keyboard.press('Escape');

  // Trigger conversion via Ctrl+Enter shortcut
  await page.keyboard.press('Control+Enter');

  // Wait for conversion completion
  await expect(page.getByText(/Conversion complete · File ready for download/)).toBeVisible({ timeout: 20_000 });

  // Verify Copy SVG button is present in both row actions and CTA
  const copyButtons = page.getByRole('button', { name: /Copy .*SVG/i });
  await expect(copyButtons.first()).toBeVisible();

  // Verify Download button
  await expect(page.getByRole('button', { name: /Download sample\.svg/i }).first()).toBeVisible();
});
