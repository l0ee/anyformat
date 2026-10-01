import { expect, test } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('stop preserves a completed conversion, discards a late result, and resumes pending files', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { releaseEncoding?: () => void; heldEncoding?: boolean };
    const original = HTMLCanvasElement.prototype.toBlob;
    let encodings = 0;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      encodings++;
      if (encodings === 2) {
        state.heldEncoding = true;
        state.releaseEncoding = original.bind(this, callback, type, quality);
      } else original.call(this, callback, type, quality);
    };
  });
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(['one', 'two', 'three'].map((name) => ({ name: `${name}.png`, mimeType: 'image/png', buffer: png })));
  await page.getByLabel('Convert all to').selectOption('jpg');
  await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { heldEncoding?: boolean }).heldEncoding);
  await expect(page.getByRole('button', { name: 'Download one.jpg', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Files finished' })).toHaveAttribute('value', '1');
  await expect(page.getByRole('progressbar', { name: 'Converting two.png' })).not.toHaveAttribute('value');
  await page.getByRole('button', { name: 'Stop processing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stopping…', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseEncoding?: () => void }).releaseEncoding?.());
  const queue = page.getByRole('region', { name: 'Format conversion queue (3)' });
  await expect(queue.getByRole('status')).toContainText('2 ready · 0 processing · 1 completed · 0 failed');
  await expect(page.getByRole('button', { name: 'Download two.jpg', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Convert all files', exact: true }).click();
  await expect(queue.getByRole('status')).toContainText('0 ready · 0 processing · 3 completed · 0 failed');
  await expect(page.getByRole('button', { name: 'Download two.jpg', exact: true })).toBeVisible();
});

test('SVG batch offers individual downloads and can stop a running trace', async ({ page }) => {
  await page.addInitScript(() => {
    let requests = 0;
    class ControlledTraceWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      postMessage(task: { id: string }) {
        requests++;
        if (requests === 2) return;
        setTimeout(() => this.onmessage?.({ data: { id: task.id, status: 'success', result: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path d="M0 0"/></svg>', width: 1, height: 1, pathCount: 1, nodeCount: 1 } } } as MessageEvent), 0);
      }
      terminate() { this.onmessage = null; }
    }
    window.Worker = ControlledTraceWorker as unknown as typeof Worker;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(['first', 'second'].map((name) => ({ name: `${name}.png`, mimeType: 'image/png', buffer: png })));
  await page.getByRole('button', { name: 'Process batch', exact: true }).click();
  const firstDownload = page.getByRole('button', { name: 'Download first.svg', exact: true });
  await expect(firstDownload).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Processing second.png' })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await firstDownload.click();
  expect((await downloaded).suggestedFilename()).toBe('first.svg');
  await page.getByRole('button', { name: 'Stop processing', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Batch queue (2 files)' }).getByRole('status')).toContainText('1 ready · 0 processing · 1 completed · 0 failed');
  await expect(page.getByRole('button', { name: 'Export 1 as ZIP' })).toBeVisible();
  await expect(firstDownload).toBeVisible();
  await page.getByRole('button', { name: 'Process batch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download second.svg', exact: true })).toBeVisible();
});

test('drag acknowledgement, comparison hint, result summary, and repo attribution work together', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const credit = page.getByRole('link', { name: 'by l0ee', exact: true });
  await expect(credit).toHaveAttribute('href', 'https://github.com/l0ee/anyformat');
  await expect(credit).toBeVisible();
  const surface = page.locator('.file-upload-surface');
  await surface.dispatchEvent('dragover');
  await expect(page.getByRole('heading', { name: 'Drop to add files' })).toBeVisible();
  await surface.dispatchEvent('dragleave');
  await page.getByRole('button', { name: 'Create SVG', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.result-size-summary')).toContainText('Original:');
  await expect(page.locator('.result-size-summary')).toContainText('Output:');
  const hint = page.getByText('Drag the divider or use the slider to compare');
  await expect(hint).toBeVisible();
  await page.getByRole('slider', { name: 'Comparison position' }).press('ArrowRight');
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
