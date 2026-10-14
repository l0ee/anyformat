import { expect, test } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('landing feature actions open the matching workspace and return focus to the tool', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try batch tracing' }).click();
  await expect(page.getByRole('button', { name: 'Work on one image', exact: true })).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: 'Open Vector Studio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Work with multiple images', exact: true })).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: 'Open converter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Convert files', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator('input[type="file"]').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('heading', { name: 'Make your files work for you.' })).toHaveCount(0);
  await expect(page.locator('.hero-header')).toHaveAttribute('data-compact', 'true');
});

for (const width of [375, 768, 1024, 1440]) {
  test(`landing keeps its primary action visible without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const upload = await page.getByText('Choose files', { exact: true }).boundingBox();
    expect(upload!.y + upload!.height).toBeLessThan(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const theme = page.getByRole('button', { name: 'Toggle theme', exact: true });
    await expect(theme).toHaveAttribute('aria-pressed', 'false');
    await theme.click();
    await expect(theme).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

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

test('conversion illustration can be paused with the keyboard and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const curve = page.locator('.motion-curve');
  const pause = page.getByRole('button', { name: 'Pause illustration animation', exact: true });
  await expect(pause).toBeVisible();
  await expect(curve).toHaveCSS('animation-iteration-count', 'infinite');
  await expect(curve).toHaveCSS('animation-duration', '6s');
  expect(await page.locator('.motion-pixels, .motion-handles, .motion-traveler').evaluateAll((elements) =>
    elements.every((element) => getComputedStyle(element).animationIterationCount === 'infinite')
  )).toBe(true);
  await expect(curve).toHaveCSS('animation-play-state', 'running');
  await pause.focus();
  await pause.press('Enter');
  const resume = page.getByRole('button', { name: 'Resume illustration animation', exact: true });
  await expect(resume).toHaveAttribute('aria-pressed', 'true');
  await expect(curve).toHaveCSS('animation-play-state', 'paused');
  await resume.press('Space');
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(curve).toHaveCSS('animation-play-state', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(curve).toHaveCSS('animation-name', 'none');
  await expect(pause).toBeHidden();
  await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
  await expect(curve).toHaveCSS('opacity', '1');
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose files', { exact: true }).click();
  await chooser;
});
