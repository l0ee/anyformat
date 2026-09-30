import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.goto('/');
});

test('ribbons gently follow the pointer and can be paused and resumed', async ({ page }) => {
  const background = page.locator('[data-animation="ambient-ribbons"]');
  const ribbon = page.locator('.ambient-ribbon-rose');
  await expect(ribbon).toHaveCSS('animation-play-state', 'running');
  await page.mouse.move(40, 80);
  await expect.poll(() => background.evaluate((node) => parseFloat(node.style.getPropertyValue('--ribbon-x')) || 0)).toBeLessThan(0);
  const offset = await background.evaluate((node) => parseFloat(node.style.getPropertyValue('--ribbon-x')));
  expect(Math.abs(offset)).toBeLessThanOrEqual(12);
  expect(offset).toBeLessThan(0);

  await page.getByRole('button', { name: 'Pause background motion' }).click();
  await expect(background).toHaveAttribute('data-paused', 'true');
  await expect(ribbon).toHaveCSS('animation-play-state', 'paused');
  await page.mouse.move(1100, 500);
  expect(await background.evaluate((node) => node.style.getPropertyValue('--ribbon-x'))).toBe('0px');

  await page.getByRole('button', { name: 'Resume background motion' }).click();
  await expect(ribbon).toHaveCSS('animation-play-state', 'running');
});

test('reduced motion disables drift and pointer response, including live changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const background = page.locator('[data-animation="ambient-ribbons"]');
  const ribbon = page.locator('.ambient-ribbon-rose');
  await expect(ribbon).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.ribbon-motion-control')).toBeHidden();
  await expect.poll(() => background.evaluate((node) => node.style.getPropertyValue('--ribbon-x'))).toBe('0px');
  await page.mouse.move(30, 70);
  expect(await background.evaluate((node) => node.style.getPropertyValue('--ribbon-x'))).toBe('0px');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(ribbon).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(ribbon).toHaveCSS('animation-name', 'ribbon-drift');
  await expect(page.getByRole('button', { name: 'Pause background motion' })).toBeVisible();
});

test('switching tabs preserves one background and the motion preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause background motion' }).click();
  await page.getByRole('button', { name: 'Format Converter', exact: true }).click();
  await expect(page.locator('[data-animation="ambient-ribbons"]')).toHaveCount(1);
  await expect(page.locator('.ambient-ribbon')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Resume background motion' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.ambient-ribbon-rose')).toHaveCSS('animation-play-state', 'paused');
});

test('hover lights the upload surface and clears when motion is paused', async ({ page }) => {
  // Keep the entire uploader in view so hover does not trigger auto-scrolling
  // (scroll intentionally clears the effect in the application).
  await page.setViewportSize({ width: 1440, height: 1200 });
  const upload = page.getByRole('group', { name: 'Drag images here or browse' });
  const background = page.locator('[data-animation="ambient-ribbons"]');
  // Avoid Firefox's smooth auto-scroll continuing after the pointer settles.
  await upload.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await upload.hover();
  // The first hover may scroll the uploader into view, which deliberately
  // clears the spotlight. A fresh pointer movement lights the settled surface.
  await upload.hover({ position: { x: 50, y: 50 } });
  await expect(upload).toHaveAttribute('data-hover-lit', 'true');
  await expect(background).toHaveAttribute('data-hover', 'true');
  await expect.poll(() => upload.evaluate((node) => getComputedStyle(node, '::after').opacity)).toBe('1');
  await expect(page.locator('.ambient-cursor-spotlight')).toHaveCSS('pointer-events', 'none');

  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Browse image', { exact: true }).click();
  await chooser;
  await page.getByRole('button', { name: 'Pause background motion' }).click();
  await upload.hover();
  await expect(upload).not.toHaveAttribute('data-hover-lit', 'true');
  await expect(background).toHaveAttribute('data-hover', 'false');
});

test('the decoration does not block mobile scrolling or file selection', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('/');
    const background = page.locator('[data-animation="ambient-ribbons"]');
    await expect(background).toHaveCSS('pointer-events', 'none');
    await page.locator('body').dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 200 });
    expect(await background.evaluate((node) => parseFloat(node.style.getPropertyValue('--ribbon-x')) || 0)).toBe(0);
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Browse image', { exact: true }).click();
    await chooser;
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});
