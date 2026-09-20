import { expect, test, type Page } from '@playwright/test';

interface ClipboardFile {
  name: string;
  mimeType: string;
}

async function pasteFiles(page: Page, files: ClipboardFile[]): Promise<boolean> {
  return page.evaluate(async (clipboardFiles) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#e11d48';
    context.fillRect(0, 0, 2, 2);

    const imageBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png');
    });
    const clipboardData = new DataTransfer();
    clipboardFiles.forEach(({ name, mimeType }) => {
      clipboardData.items.add(new File([imageBlob], name, { type: mimeType }));
    });

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    (document.activeElement ?? document.body).dispatchEvent(pasteEvent);
    return pasteEvent.defaultPrevented;
  }, files);
}

async function pasteText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'ordinary clipboard text');
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
    document.body.dispatchEvent(pasteEvent);
    return pasteEvent.defaultPrevented;
  });
}

test('pastes supported clipboard images into the active vectorizer, batch, and universal uploaders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Or paste an image with Ctrl+V / ⌘V')).toBeVisible();

  expect(await pasteFiles(page, [{ name: '', mimeType: 'image/png' }])).toBe(true);
  await expect(page.getByRole('img', { name: 'Preview of pasted-image.png' })).toBeVisible();

  await page.getByRole('button', { name: /Vector Batch|SVG Batch/i }).click();
  await expect(page.getByText('Or paste an image with Ctrl+V / ⌘V')).toBeVisible();
  expect(await pasteFiles(page, [
    { name: '', mimeType: 'image/png' },
    { name: '', mimeType: 'image/png' },
  ])).toBe(true);
  await expect(page.getByRole('heading', { name: 'Batch queue (2 files)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'pasted-image.png' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'pasted-image-2.png' })).toBeVisible();

  await page.getByRole('button', { name: 'Format Converter' }).click();
  await expect(page.getByText('Or paste an image with Ctrl+V / ⌘V')).toBeVisible();
  expect(await pasteFiles(page, [{ name: '', mimeType: 'image/png' }])).toBe(true);
  await expect(page.getByRole('heading', { name: 'Format conversion queue (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'pasted-image.png' })).toBeVisible();
  expect(await pasteFiles(page, [{ name: 'mismatch.svg', mimeType: 'image/png' }])).toBe(true);
  await expect(page.getByRole('heading', { name: 'Format conversion queue (2)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'mismatch.png' })).toBeVisible();

  await page.evaluate(() => {
    const editor = document.createElement('textarea');
    editor.setAttribute('aria-label', 'Paste guard editor');
    document.body.append(editor);
    editor.focus();
  });
  expect(await pasteFiles(page, [{ name: '', mimeType: 'image/png' }])).toBe(false);
  await expect(page.getByRole('heading', { name: 'Format conversion queue (2)' })).toBeVisible();

  await page.evaluate(() => {
    document.querySelector('[aria-label="Paste guard editor"]')?.remove();
    document.body.focus();
  });
  expect(await pasteFiles(page, [{ name: '', mimeType: 'image/tiff' }])).toBe(false);
  expect(await pasteText(page)).toBe(false);
  await expect(page.getByRole('heading', { name: 'Format conversion queue (2)' })).toBeVisible();
});
