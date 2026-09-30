import { expect, test } from '@playwright/test';

test('layers ambient ribbons behind the readable hero and clickable converter controls', async ({ page }) => {
  await page.goto('/');

  const background = page.locator('[data-animation="ambient-ribbons"]');
  await expect(background).toHaveCount(1);
  await expect(background).toHaveAttribute('aria-hidden', 'true');
  await expect(background).toHaveCSS('pointer-events', 'none');
  await expect(background).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('color', 'rgb(28, 25, 23)');
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByText('Browse image', { exact: true }).click();
  await fileChooser;

  await page.getByRole('button', { name: 'Format Converter', exact: true }).click();
  await expect(heading).toHaveText('Universal File Converter');
});
