import { expect, test } from '@playwright/test';

test('keeps a stable workspace in light and dark themes without decorative animation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-animation]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose files', { exact: true }).click();
  await chooser;
});
