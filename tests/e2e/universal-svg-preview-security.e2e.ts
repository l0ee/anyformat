import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __svgPreviewProbe: { scripts: number; eventHandlers: number };
  }
}

const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" onload="parent.__svgPreviewProbe.eventHandlers += 1"><script>parent.__svgPreviewProbe.scripts += 1</script><rect width="32" height="32" fill="blue"/></svg>';

async function expectNoScriptExecution(page: Page) {
  expect(await page.evaluate(() => window.__svgPreviewProbe)).toEqual({
    scripts: 0,
    eventHandlers: 0,
  });
}

for (const policyMode of ['production', 'csp-free'] as const) {
  test.describe(`${policyMode} SVG preview security`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.__svgPreviewProbe = { scripts: 0, eventHandlers: 0 };
      });
      if (policyMode === 'csp-free') {
        // Remove both policies only in this test response. Otherwise CSP could
        // mask a regression from image rendering to an executable document.
        await page.route((url) => url.pathname === '/', async (route) => {
          const response = await route.fetch();
          const headers = response.headers();
          delete headers['content-security-policy'];
          delete headers['content-encoding'];
          delete headers['content-length'];
          const body = (await response.text()).replace(
            /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
            '',
          );
          await route.fulfill({ response, headers, body });
        });
      }
      const response = await page.goto('/');
      expect(Boolean(response?.headers()['content-security-policy'])).toBe(policyMode === 'production');
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(policyMode === 'production' ? 1 : 0);
    });

    for (const target of ['png', 'pdf'] as const) {
      test(`keeps malicious SVG inert in source preview and ${target.toUpperCase()} conversion`, async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles({
          name: 'payload.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(maliciousSvg),
        });
        const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'payload.svg', exact: true }) });
        await row.getByRole('button', { name: 'Preview', exact: true }).click();
        const source = row.getByRole('img', { name: 'Source preview for payload.svg', exact: true });
        await expect(source).toBeVisible();
        await source.evaluate((image: HTMLImageElement) => image.decode());
        await expect(row.locator('iframe, object, embed')).toHaveCount(0);
        await expectNoScriptExecution(page);

        await page.getByLabel('Output for payload.svg').selectOption(target);
        await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
        await expect(page.getByRole('button', { name: `Download payload.${target}`, exact: true })).toBeVisible({ timeout: 60_000 });

        if (target === 'pdf') {
          const frame = row.getByTitle('PDF preview for payload.svg');
          await expect(frame).toBeVisible();
          const result = await frame.evaluate(async (element: HTMLIFrameElement) => {
            const blob = await (await fetch(element.src)).blob();
            return { mime: blob.type, signature: await blob.slice(0, 5).text() };
          });
          expect(result).toEqual({ mime: 'application/pdf', signature: '%PDF-' });
          const pdfUrl = await frame.getAttribute('src');
          expect(pdfUrl).toBeTruthy();
          await expect(row.getByRole('link', { name: 'open payload.pdf in a new tab' })).toHaveAttribute('href', pdfUrl!);
          await expect(row.getByRole('link', { name: 'download payload.pdf' })).toHaveAttribute('download', 'payload.pdf');
        } else {
          const result = row.getByRole('img', { name: 'Converted preview for payload.svg', exact: true });
          await expect(result).toBeVisible();
          await result.evaluate((image: HTMLImageElement) => image.decode());
          await expect(row.locator('iframe, object, embed')).toHaveCount(0);
        }
        await expectNoScriptExecution(page);
      });
    }

    test('renders generated SVG results as images', async ({ page }) => {
      const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'blue';
        context.fillRect(0, 0, 32, 32);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await page.locator('input[type="file"]').setInputFiles({
        name: 'raster.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
      });
      await page.getByLabel('Output for raster.png').selectOption('svg');
      await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Download raster.svg', exact: true })).toBeVisible({ timeout: 60_000 });
      const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'raster.png', exact: true }) });
      await row.getByRole('button', { name: 'Preview', exact: true }).click();
      const image = row.getByRole('img', { name: 'Converted preview for raster.png', exact: true });
      await expect(image).toBeVisible();
      const mime = await image.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return (await (await fetch(element.src)).blob()).type;
      });
      expect(mime).toBe('image/svg+xml');
      await expect(row.locator('iframe, object, embed')).toHaveCount(0);
      await expectNoScriptExecution(page);
    });

    if (policyMode === 'csp-free') {
      test('positive control executes the same payload in an unsandboxed SVG frame', async ({ page }) => {
        const url = await page.evaluate((svg) => {
          const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          const frame = document.createElement('iframe');
          frame.id = 'svg-security-positive-control';
          frame.src = url;
          document.body.appendChild(frame);
          return url;
        }, maliciousSvg);
        try {
          await page.waitForFunction(() => {
            const probe = window.__svgPreviewProbe;
            return probe.scripts > 0 && probe.eventHandlers > 0;
          });
        } finally {
          await page.evaluate((url) => {
            document.getElementById('svg-security-positive-control')?.remove();
            URL.revokeObjectURL(url);
          }, url);
        }
      });
    }
  });
}
