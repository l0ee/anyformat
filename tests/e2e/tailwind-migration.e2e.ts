import { expect, test } from '@playwright/test';

test('preserves sibling gaps, hidden children, nested typography and workspace precedence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'tailwind-migration-fixture';
    fixture.innerHTML = `
      <div data-fixture="stack" class="space-y-4 sm:space-y-8"><p>First</p><p hidden>Hidden</p><p>Second</p></div>
      <div data-fixture="row" class="flex space-x-1"><span>First</span><span hidden>Hidden</span><span>Second</span></div>
      <p data-fixture="type" class="text-xs">Parent <span class="text-[10px]">Child</span></p>
      <div class="app-main"><fieldset class="p-6">Settings</fieldset><button class="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:scale-105">Action</button></div>
    `;
    document.body.appendChild(fixture);
  });
  const fixture = page.locator('#tailwind-migration-fixture');
  const second = fixture.locator('[data-fixture="stack"] p').last();
  await expect(second).toHaveCSS('margin-top', '16px');
  // Read both rectangles in one layout snapshot; fonts/scroll anchoring can
  // move the fixture between separate browser-protocol calls in WebKit.
  const gap = () => fixture.locator('[data-fixture="stack"]').evaluate((stack) => {
    const before = stack.firstElementChild!.getBoundingClientRect();
    const after = stack.lastElementChild!.getBoundingClientRect();
    return after.top - before.bottom;
  });
  expect(await gap()).toBe(16);
  await expect(fixture.locator('[data-fixture="row"] span').last()).toHaveCSS('margin-left', '4px');
  await expect(fixture.locator('[data-fixture="type"] span')).toHaveCSS('line-height', '16px');
  await expect(fixture.locator('fieldset')).toHaveCSS('padding', '20px');
  const button = fixture.getByRole('button', { name: 'Action', exact: true });
  await expect(button).toHaveCSS('border-radius', '8px');
  await expect(button).toHaveCSS('background-image', 'none');
  await expect(button).toHaveCSS('background-color', 'rgb(225, 29, 72)');
  await button.hover();
  expect(await button.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.scale === '1' || style.scale === 'none';
  })).toBe(true);
  await page.setViewportSize({ width: 1280, height: 844 });
  await expect(second).toHaveCSS('margin-top', '32px');
  expect(await gap()).toBe(32);
});

test('retains class-based themes and visible keyboard focus in forced colors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  // Native Tab navigation establishes keyboard modality in Firefox as well;
  // focus() after a mouse click does not necessarily match :focus-visible.
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
  await close.focus();
  await expect(close).toBeFocused();
  await page.emulateMedia({ forcedColors: 'active' });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await close.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await expect(close).toHaveCSS('outline-style', 'solid');
  await expect(close).toHaveCSS('outline-width', '2px');
});
