import { expect, test } from '@playwright/test';

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>');
const file = (name: string) => ({ name, mimeType: 'image/svg+xml', buffer: svg });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Convert files', exact: true }).click();
});

test('shrinks the workspace after upload and gives a single result one download action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hero = page.locator('.hero-header');
  const before = await hero.boundingBox();
  await page.locator('input[type="file"]').setInputFiles(file('single.svg'));
  await expect(hero).toHaveAttribute('data-compact', 'true');
  const after = await hero.boundingBox();
  expect(after!.height).toBeLessThan(before!.height);
  await expect(page.getByLabel('Convert all to')).toHaveCount(0);
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: 'Download single.png', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Download single.png', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Convert another file' }).click();
  await expect(hero).toHaveAttribute('data-compact', 'false');
  await expect(page.getByText('Choose files', { exact: true })).toBeVisible();
});

test('keeps filters recoverable when removal leaves fewer than three files', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles([file('alpha.svg'), file('beta.svg'), file('gamma.svg')]);
  await page.getByLabel('Search queue').fill('alpha');
  await expect(page.getByRole('heading', { name: 'alpha.svg', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove alpha.svg from conversion queue' }).click();
  await expect(page.getByText('No files match. Reset filters or try another search.')).toBeVisible();
  await expect(page.getByLabel('Search queue')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('heading', { name: 'beta.svg', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'gamma.svg', exact: true })).toBeVisible();
});

test('bulk output tracks per-file changes and advanced filters stay optional', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles([file('alpha.svg'), file('beta.svg'), file('gamma.svg')]);
  const bulk = page.getByLabel('Convert all to');
  await bulk.selectOption('webp');
  await expect(bulk).toHaveValue('webp');
  await page.getByLabel('Output for beta.svg').selectOption('jpg');
  await expect(bulk).toHaveValue('');
  await expect(page.getByLabel('Filter by category')).toBeHidden();
  await page.getByText('Filter and sort', { exact: true }).click();
  await page.getByLabel('Filter by category').selectOption('image');
  await expect(page.getByText('No files match. Reset filters or try another search.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all files' }).click();
  await expect(page.getByRole('heading', { name: 'alpha.svg', exact: true })).toBeVisible();
});

test('loads PDF libraries only when a PDF export is requested', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.reload();
  await page.getByRole('button', { name: 'Convert files', exact: true }).click();
  await expect(page.getByLabel('Browse files for the format conversion queue')).toBeVisible();
  expect(requested.some((url) => /vendor-(pdfjs|pdflib|jszip)-/.test(url))).toBe(false);

  await page.locator('input[type="file"]').setInputFiles(file('on-demand.svg'));
  await page.getByLabel('Output for on-demand.svg').selectOption('pdf');
  await page.getByRole('button', { name: 'Convert all files' }).click();
  await expect(page.getByRole('button', { name: 'Download on-demand.pdf', exact: true })).toBeVisible();
  expect(requested.some((url) => /vendor-pdflib-/.test(url))).toBe(true);
});
