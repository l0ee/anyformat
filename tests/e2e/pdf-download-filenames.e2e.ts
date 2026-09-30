import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

test('preserves the selected PDF page filename in manual downloads and ZIP exports without auto-downloading', async ({ page }) => {
  test.setTimeout(90_000);
  const pdf = await PDFDocument.create();
  pdf.addPage([32, 32]);
  pdf.addPage([32, 32]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Format Converter', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()),
  });
  const pageNumber = page.getByLabel('PDF page for report.pdf');
  // Cold PDF.js worker startup can take longer on shared CI runners.
  await expect(pageNumber).toBeEnabled({ timeout: 60_000 });
  await expect(pageNumber).toHaveAttribute('max', '2');
  await pageNumber.fill('2');
  await page.getByLabel('Output for report.pdf').selectOption('png');
  let downloadCount = 0;
  page.on('download', () => { downloadCount++; });
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: 'Download report_p2.png', exact: true })).toBeVisible({ timeout: 60_000 });
  expect(downloadCount).toBe(0);

  const manual = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report_p2.png', exact: true }).click();
  expect((await manual).suggestedFilename()).toBe('report_p2.png');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'idle.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'),
  });
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ZIP (1)' }).click();
  const stream = await (await zipDownload).createReadStream();
  if (!stream) throw new Error('ZIP download stream unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toEqual(['report_p2.png']);
});
