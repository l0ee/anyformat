import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts, drawObject, popGraphicsState, pushGraphicsState, scale, translate } from 'pdf-lib';

for (const policyMode of ['header-and-html', 'html-only'] as const) {
  test(`renders PDF fonts, JPEG and JPEG2000 under ${policyMode} production CSP`, async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const diagnostics: string[] = [];
    page.on('console', (message) => {
      if (/content security policy|wasm|jpx|jbig|standardFontDataUrl/i.test(message.text())) {
        diagnostics.push(message.text());
      }
    });
    if (policyMode === 'html-only') {
      // Simulate a static host without the optional Node server's CSP header.
      await page.route(`${new URL('/', baseURL).href}**`, async (route) => {
        const response = await route.fetch();
        const headers = response.headers();
        delete headers['content-security-policy'];
        await route.fulfill({ response, headers });
      });
    }
    const response = await page.goto('/');
    expect(Boolean(response?.headers()['content-security-policy'])).toBe(policyMode === 'header-and-html');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
    const htmlPolicy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    if (policyMode === 'header-and-html') {
      expect(response?.headers()['content-security-policy']).toBe(`${htmlPolicy}; frame-ancestors 'none'`);
    }

    const jpeg = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, 32, 32);
      return canvas.toDataURL('image/jpeg').split(',')[1];
    });
    const pdf = await PDFDocument.create();
    const sheet = pdf.addPage([200, 160]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    sheet.drawText('PDF font test', { x: 10, y: 130, size: 20, font });
    const jpg = await pdf.embedJpg(Uint8Array.from(Buffer.from(jpeg, 'base64')));
    sheet.drawImage(jpg, { x: 10, y: 10, width: 60, height: 60 });
    const jp2 = readFileSync(new URL('../fixtures/blue.jp2', import.meta.url));
    const image = pdf.context.register(pdf.context.stream(jp2, {
      Type: 'XObject', Subtype: 'Image', Width: 32, Height: 32,
      ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'JPXDecode',
    }));
    const imageName = sheet.node.newXObject('JP2', image);
    sheet.pushOperators(pushGraphicsState(), translate(100, 10), scale(60, 60), drawObject(imageName), popGraphicsState());

    await page.locator('input[type="file"]').setInputFiles({
      name: 'codecs.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()),
    });
    await expect(page.getByLabel('PDF page for codecs.pdf')).toBeEnabled({ timeout: 60_000 });
    await page.getByLabel('Output for codecs.pdf').selectOption('png');
    await page.getByRole('button', { name: 'Convert all files' }).click();
    await expect(page.getByRole('button', { name: 'Download codecs.png', exact: true })).toBeVisible({ timeout: 60_000 });
    const item = page.locator('li').filter({ hasText: 'codecs.pdf' });
    await item.getByRole('button', { name: 'Preview', exact: true }).click();
    const pixels = await page.getByRole('img', { name: 'Converted preview for codecs.pdf' }).evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const at = (x: number, y: number) => Array.from(context.getImageData(x * 2, (160 - y) * 2, 1, 1).data).slice(0, 3);
      const text = context.getImageData(20, 20, 300, 45).data;
      let darkPixels = 0;
      for (let i = 0; i < text.length; i += 4) {
        if (text[i] < 100 && text[i + 1] < 100 && text[i + 2] < 100 && text[i + 3] > 0) darkPixels++;
      }
      return { jpeg: at(40, 40), jpeg2000: at(130, 40), darkPixels };
    });
    expect(diagnostics).toEqual([]);
    expect(pixels.jpeg[0]).toBeGreaterThan(200);
    expect(pixels.jpeg[2]).toBeLessThan(50);
    expect(pixels.jpeg2000[2]).toBeGreaterThan(200);
    expect(pixels.jpeg2000[0]).toBeLessThan(50);
    expect(pixels.darkPixels).toBeGreaterThan(50);
  });
}

test('production CSP blocks injected inline scripts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const probe = window as unknown as { inlineScriptRan?: boolean; inlineScriptBlocked?: boolean };
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.blockedURI === 'inline' && event.effectiveDirective === 'script-src-elem') probe.inlineScriptBlocked = true;
    });
    const script = document.createElement('script');
    script.textContent = 'window.inlineScriptRan = true';
    document.head.appendChild(script);
  });
  await page.waitForFunction(() => (window as unknown as { inlineScriptBlocked?: boolean }).inlineScriptBlocked === true);
  expect(await page.evaluate(() => (window as unknown as { inlineScriptRan?: boolean }).inlineScriptRan)).toBeUndefined();
});
