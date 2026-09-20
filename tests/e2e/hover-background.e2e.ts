import { expect, test } from '@playwright/test';

test('renders hover background container without blocking main workflow elements', async ({ page }) => {
  await page.goto('/');

  const hoverLayer = page.locator('.hover-glow-blob');
  await expect(hoverLayer).toHaveCount(1);
  await expect(hoverLayer).toHaveAttribute('aria-hidden', 'true');

  const shellBackground = await page.locator('.app-shell').evaluate((element) =>
    window.getComputedStyle(element).backgroundImage
  );
  expect(shellBackground).toContain('linear-gradient');

  await page.mouse.move(100, 100);
  await page.mouse.move(300, 300);

  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.hover-glow-blob')).toHaveCSS('display', 'none');
});
