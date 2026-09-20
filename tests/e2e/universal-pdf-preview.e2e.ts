import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __createdObjectUrls: Array<{ url: string; mimeType: string }>;
  }
}

const validSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#e11d48"/></svg>',
);

test('previews PDF results accessibly with open and download fallbacks', async ({ page }) => {
  await page.addInitScript(() => {
    window.__createdObjectUrls = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      const url = createObjectURL(object);
      window.__createdObjectUrls.push({
        url,
        mimeType: object instanceof Blob ? object.type : '',
      });
      return url;
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'report.svg',
    mimeType: 'image/svg+xml',
    buffer: validSvg,
  });
  await page.getByLabel('Output for report.svg').selectOption('pdf');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByText('1 completed of 1')).toBeVisible({ timeout: 60_000 });

  const pdfObjectUrl = await page.evaluate(() =>
    window.__createdObjectUrls.find(({ mimeType }) => mimeType === 'application/pdf')?.url,
  );
  expect(pdfObjectUrl).toBeTruthy();
  const objectUrlCountBeforePreview = await page.evaluate(() => window.__createdObjectUrls.length);

  const item = page.locator('li').filter({ hasText: 'report.svg' });
  await item.getByRole('button', { name: 'Preview' }).click();

  const pdfFrame = page.getByTitle('PDF preview for report.svg');
  await expect(pdfFrame).toBeVisible();
  await expect(pdfFrame).toHaveAttribute('src', pdfObjectUrl!);

  const openLink = page.getByRole('link', { name: 'open report.pdf in a new tab' });
  await expect(openLink).toHaveAttribute('href', pdfObjectUrl!);
  await expect(openLink).toHaveAttribute('target', '_blank');

  const downloadLink = page.getByRole('link', { name: 'download report.pdf' });
  await expect(downloadLink).toHaveAttribute('href', pdfObjectUrl!);
  await expect(downloadLink).toHaveAttribute('download', 'report.pdf');
  await expect(page.locator('img[alt="Converted preview for report.svg"]')).toHaveCount(0);

  const objectUrlCountAfterPreview = await page.evaluate(() => window.__createdObjectUrls.length);
  expect(objectUrlCountAfterPreview).toBe(objectUrlCountBeforePreview);
});
